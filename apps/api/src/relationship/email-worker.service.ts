import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { Prisma, type OutboxTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';
import { StorageService } from '../cms/storage.service';
import { RelationshipService } from './relationship.service';
import { decryptMail, renderTransactionalMail } from './email-outbox';
import { tokenHash } from '../auth/cookies';

@Injectable()
export class RelationshipWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly instance = randomUUID();
  private readonly logger = new Logger('RelationshipWorker');
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly relationships: RelationshipService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  onApplicationBootstrap() {
    if (!this.environment.RELATIONSHIP_WORKER_ENABLED || this.environment.NODE_ENV === 'test')
      return;
    this.timer = setInterval(() => void this.tick(), 60000);
    this.timer.unref();
    void this.tick();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async tick() {
    if (this.running) return this.running;
    this.running = this.process()
      .catch(() => this.logger.warn('relationship.worker.failed'))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private claim() {
    const now = new Date();
    const stale = new Date(now.getTime() - 5 * 60000);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE outbox_tasks SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED'::"TaskStatus" ELSE 'PENDING'::"TaskStatus" END, locked_at=NULL, locked_by=NULL, available_at=${now}, last_error_code='LEASE_EXPIRED', updated_at=${now} WHERE topic IN ('mail.send','storage.delete-private') AND status='PROCESSING' AND (locked_at IS NULL OR locked_at < ${stale})`;
      await tx.$executeRaw`UPDATE outbox_tasks SET status='FAILED',last_error_code='ATTEMPTS_EXHAUSTED',updated_at=${now} WHERE topic IN ('mail.send','storage.delete-private') AND status='PENDING' AND attempts >= max_attempts`;
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM outbox_tasks WHERE topic IN ('mail.send','storage.delete-private') AND status='PENDING' AND available_at <= ${now} AND attempts < max_attempts ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.outboxTask.update({
        where: { id: rows[0].id },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
          lockedAt: now,
          lockedBy: this.instance,
        },
      });
    });
  }
  private async deliver(task: OutboxTask) {
    if (task.topic === 'storage.delete-private') {
      const p = task.payload;
      if (
        !p ||
        typeof p !== 'object' ||
        Array.isArray(p) ||
        typeof p.key !== 'string' ||
        !['local', 'r2'].includes(String(p.driver))
      )
        throw new Error('INVALID_DELETE');
      await this.storage.remove(p.key, 'PRIVATE', String(p.driver));
      return;
    }
    const mail = decryptMail(this.environment, task.payload, task.idempotencyKey);
    if (mail.expiresAt && new Date(mail.expiresAt).getTime() <= Date.now()) return;
    if (
      mail.kind === 'contact' &&
      (!mail.contactId || !(await this.db.contact.findUnique({ where: { id: mail.contactId } })))
    )
      return;
    if (mail.token) {
      const hash = tokenHash(this.environment, mail.token);
      if (mail.kind === 'recovery') {
        const token = await this.db.passwordResetToken.findUnique({
          where: { tokenHash: hash },
          include: { user: true },
        });
        if (!token || token.usedAt || token.expiresAt <= new Date() || !token.user.isActive) return;
      } else {
        const token = await this.db.newsletterToken.findUnique({
          where: { tokenHash: hash },
          include: { subscriber: true },
        });
        if (
          !token ||
          token.usedAt ||
          token.expiresAt <= new Date() ||
          (mail.kind === 'newsletter-confirm'
            ? token.subscriber.status !== 'PENDING'
            : token.subscriber.status !== 'ACTIVE')
        )
          return;
      }
    }
    if (this.environment.MOCK_INTEGRATIONS && this.environment.APP_ENV === 'development') {
      // Local mailbox remains encrypted. No token, recipient or body is printed or served publicly.
      const root = resolve(this.environment.MAIL_LOCAL_PATH);
      await mkdir(root, { recursive: true });
      await writeFile(
        join(root, `${task.id}.json`),
        JSON.stringify({ id: task.id, idempotencyKey: task.idempotencyKey, payload: task.payload }),
        { mode: 0o600 },
      );
      return;
    }
    if (
      !this.environment.RESEND_ENABLED ||
      !this.environment.RESEND_API_KEY ||
      !this.environment.RESEND_FROM_EMAIL
    )
      throw new Error('MAIL_DISABLED');
    // Resend retains deduplication keys for 24 h; stop retries before the key expires.
    if (Date.now() - task.createdAt.getTime() >= 23 * 3600000)
      throw new Error('MAIL_DEDUPLICATION_EXPIRED');
    if (
      this.environment.APP_ENV === 'staging' &&
      !(this.environment.RESEND_TEST_RECIPIENTS ?? '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .includes(mail.recipient.toLowerCase())
    )
      throw new Error('RECIPIENT_FORBIDDEN');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.environment.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': task.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.environment.RESEND_FROM_EMAIL,
        to: [mail.recipient],
        ...renderTransactionalMail(this.environment, mail),
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('MAIL_PROVIDER_FAILED');
    }
    const ack: unknown = await response.json();
    if (!ack || typeof ack !== 'object' || !('id' in ack) || typeof ack.id !== 'string')
      throw new Error('MAIL_PROVIDER_FAILED');
  }
  private async process() {
    await this.relationships.purgeExpired();
    await this.purgeLocalMailbox();
    for (let i = 0; i < 50; i++) {
      const task = await this.claim();
      if (!task) break;
      const where: Prisma.OutboxTaskWhereInput = {
        id: task.id,
        status: 'PROCESSING',
        lockedBy: this.instance,
        lockedAt: task.lockedAt,
      };
      try {
        await this.deliver(task);
        await this.db.outboxTask.updateMany({
          where,
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: null,
            payload: { redacted: true },
          },
        });
      } catch {
        const failed =
          task.attempts >= task.maxAttempts ||
          (task.topic === 'mail.send' && Date.now() - task.createdAt.getTime() >= 23 * 3600000);
        await this.db.outboxTask.updateMany({
          where,
          data: {
            status: failed ? 'FAILED' : 'PENDING',
            lockedAt: null,
            lockedBy: null,
            availableAt: new Date(Date.now() + Math.min(900000, 60000 * 2 ** (task.attempts - 1))),
            lastErrorCode:
              task.topic === 'mail.send' ? 'MAIL_DELIVERY_FAILED' : 'STORAGE_DELETE_FAILED',
          },
        });
        if (failed) this.logger.warn('relationship.task.exhausted');
      }
    }
    await this.db.outboxTask.deleteMany({
      where: {
        topic: 'mail.send',
        status: { in: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: new Date(Date.now() - 7 * 86400000) },
      },
    });
    await this.db.mailWebhookEvent.deleteMany({
      where: { receivedAt: { lt: new Date(Date.now() - 30 * 86400000) } },
    });
  }
  private async purgeLocalMailbox() {
    if (!this.environment.MOCK_INTEGRATIONS || this.environment.APP_ENV !== 'development') return;
    const root = resolve(this.environment.MAIL_LOCAL_PATH);
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
    const expiredBefore = Date.now() - 7 * 86400000;
    // Only files owned by the local mailbox are eligible; never recurse or follow links.
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(json|html)$/u.test(
          entry.name,
        )
      )
        continue;
      const target = join(root, entry.name);
      try {
        const metadata = await lstat(target);
        if (metadata.isFile() && metadata.mtimeMs < expiredBefore) await unlink(target);
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT')
          throw error;
      }
    }
  }
}
