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
import { PrismaService } from '../database/prisma.service';
import { ArticlesService } from '../domain/articles.service';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';
import { StorageService } from './storage.service';
import { redirectPath } from './redirects';

@Injectable()
export class CmsWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly instance = randomUUID();
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger('CmsWorker');
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly storage: StorageService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  onApplicationBootstrap() {
    if (!this.environment.CMS_WORKER_ENABLED || this.environment.NODE_ENV === 'test') return;
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
      .catch(() => this.logger.warn('cms.worker.failed'))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async claim(now: Date) {
    return this.db.$transaction(async (tx) => {
      const stale = new Date(now.getTime() - 5 * 60000);
      await tx.$executeRaw`UPDATE outbox_tasks SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED'::"TaskStatus" ELSE 'PENDING'::"TaskStatus" END, locked_at = NULL, locked_by = NULL, available_at = ${now}, last_error_code = 'LEASE_EXPIRED', updated_at = ${now} WHERE topic IN ('cache.revalidate','media.delete') AND status = 'PROCESSING' AND (locked_at IS NULL OR locked_at < ${stale})`;
      await tx.$executeRaw`UPDATE outbox_tasks SET status = 'FAILED', last_error_code = 'ATTEMPTS_EXHAUSTED', updated_at = ${now} WHERE topic IN ('cache.revalidate','media.delete') AND status = 'PENDING' AND attempts >= max_attempts`;
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM outbox_tasks WHERE topic IN ('cache.revalidate','media.delete') AND status = 'PENDING' AND available_at <= ${now} AND attempts < max_attempts ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1`;
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
    const payload = task.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Invalid task');
    if (task.topic === 'cache.revalidate') {
      if (
        !Array.isArray(payload.paths) ||
        !payload.paths.length ||
        payload.paths.length > 100 ||
        !payload.paths.every(redirectPath)
      )
        throw new Error('Invalid paths');
      const response = await fetch(new URL('/api/revalidate', this.environment.WEB_PUBLIC_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Revalidation-Secret': this.environment.REVALIDATION_SECRET,
        },
        body: JSON.stringify({ idempotencyKey: task.idempotencyKey, paths: payload.paths }),
        signal: AbortSignal.timeout(this.environment.REVALIDATION_TIMEOUT_MS),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Revalidation failed');
      const ack: unknown = await response.json();
      if (
        !ack ||
        typeof ack !== 'object' ||
        !('revalidated' in ack) ||
        ack.revalidated !== true ||
        !('idempotencyKey' in ack) ||
        ack.idempotencyKey !== task.idempotencyKey
      )
        throw new Error('Invalid acknowledgment');
    } else {
      if (
        typeof payload.key !== 'string' ||
        !['local', 'r2'].includes(String(payload.driver)) ||
        !['PUBLIC', 'PRIVATE'].includes(String(payload.visibility))
      )
        throw new Error('Invalid delete');
      await this.storage.remove(
        payload.key,
        payload.visibility as 'PUBLIC' | 'PRIVATE',
        String(payload.driver),
      );
    }
  }
  private async process() {
    await this.articles.publishDue();
    for (let index = 0; index < 50; index++) {
      const now = new Date();
      const task = await this.claim(now);
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
          },
        });
      } catch {
        const failed = task.attempts >= task.maxAttempts;
        await this.db.outboxTask.updateMany({
          where,
          data: {
            status: failed ? 'FAILED' : 'PENDING',
            availableAt: new Date(Date.now() + Math.min(900000, 60000 * 2 ** (task.attempts - 1))),
            lockedAt: null,
            lockedBy: null,
            lastErrorCode:
              task.topic === 'cache.revalidate'
                ? 'CACHE_REVALIDATION_FAILED'
                : 'STORAGE_DELETE_FAILED',
          },
        });
        if (failed) this.logger.warn('cms.task.exhausted');
      }
    }
  }
}
