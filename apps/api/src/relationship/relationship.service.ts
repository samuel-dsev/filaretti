import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import type {
  AdminContact,
  AdminSubscriber,
  RelationshipAccepted,
  ContactDownloadIssued,
} from '@filaretti/types';
import { Prisma, type ContactFile, type NewsletterSubscriber } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { SessionUser } from '../auth/types';
import { tokenHash } from '../auth/cookies';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../cms/storage.service';
import { validateUpload, type UploadedFile } from '../cms/upload';
import { DOMAIN_ENVIRONMENT, audit, paginated, paging, versionUpdated } from '../domain/shared';
import {
  ContactDto,
  ContactQueryDto,
  ContactStatusDto,
  NewsletterSubscribeDto,
  SubscriberQueryDto,
} from './dto';
import { queueEmail } from './email-outbox';
import { RelationshipRateLimiter, relationshipHash } from './rate-limit.service';
import { TurnstileService, localRelationshipMocks } from './turnstile.service';
import { AttachmentScanner } from './attachment-scanner';

export const CONTACT_FILE_TOTAL_LIMIT = 15 * 1024 * 1024;
export const CONTACT_FILE_COUNT_LIMIT = 3;
const accepted: RelationshipAccepted = {
  accepted: true,
  message: 'Solicitação recebida. Confira seu e-mail quando necessário.',
};
const contactInclude = { files: true } satisfies Prisma.ContactInclude;
type ContactRecord = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;
const safeFilename = (name: string) =>
  basename(name.replaceAll('\\', '/'))
    .replace(/[\x00-\x1f\x7f";\r\n]/gu, '_')
    .slice(-200) || 'arquivo';

function contactView(row: ContactRecord): AdminContact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    state: row.state,
    subject: row.subject,
    message: row.message,
    practiceAreaId: row.practiceAreaId,
    status: row.status,
    privacyVersion: row.privacyVersion,
    consentedAt: row.consentedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
    attachments: row.files.map(({ id, filename, mimeType, size, scanStatus }) => ({
      id,
      filename,
      mimeType,
      size,
      scanStatus,
    })),
  };
}
function subscriberView(row: NewsletterSubscriber): AdminSubscriber {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    consentVersion: row.consentVersion,
    consentedAt: row.consentedAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

@Injectable()
export class RelationshipService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly turnstile: TurnstileService,
    private readonly limiter: RelationshipRateLimiter,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
    private readonly scanner: AttachmentScanner = new AttachmentScanner(environment),
  ) {}

  private tokenHash(token: string) {
    return tokenHash(this.environment, token);
  }

  private async emailLock(tx: Prisma.TransactionClient, email: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`newsletter:${email}`}))`,
    );
  }

  /** Metadata is durable before upload; crash recovery never needs a bucket listing. */
  private async stage(files: UploadedFile[]): Promise<ContactFile[]> {
    const result: ContactFile[] = [];
    const scanDeadline = Date.now() + 15000;
    try {
      for (const file of files) {
        const validated = await validateUpload(file);
        let scanStatus: ContactFile['scanStatus'] =
          localRelationshipMocks(this.environment) &&
          this.environment.CONTACT_SCANNER_DRIVER === 'disabled'
            ? 'LOCAL_VERIFIED'
            : 'QUARANTINED';
        if (this.environment.CONTACT_SCANNER_DRIVER === 'clamav') {
          const original = await this.scanner.scan(file.buffer, scanDeadline);
          if (original === 'INFECTED')
            throw new BadRequestException({ code: 'ATTACHMENT_REJECTED' });
          const normalized =
            original === 'CLEAN'
              ? await this.scanner.scan(validated.bytes, scanDeadline)
              : 'UNAVAILABLE';
          if (normalized === 'INFECTED')
            throw new BadRequestException({ code: 'ATTACHMENT_REJECTED' });
          if (original === 'CLEAN' && normalized === 'CLEAN') scanStatus = 'VERIFIED';
        }
        const row = await this.db.contactFile.create({
          data: {
            storageKey: `${randomUUID()}.${validated.extension}`,
            storageDriver: this.environment.STORAGE_DRIVER,
            filename: safeFilename(file.originalname),
            mimeType: validated.mimeType,
            size: validated.bytes.length,
            scanStatus,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        result.push(row);
        await this.storage.put(row.storageKey, 'PRIVATE', row.mimeType, validated.bytes);
      }
      return result;
    } catch (error) {
      await this.cleanStaged(result).catch(() => undefined);
      throw error;
    }
  }

  private async queueFileDelete(
    tx: Prisma.TransactionClient,
    file: Pick<ContactFile, 'id' | 'storageKey' | 'storageDriver'>,
  ) {
    await tx.outboxTask.upsert({
      where: { idempotencyKey: `contact-file-delete:${file.id}` },
      create: {
        topic: 'storage.delete-private',
        idempotencyKey: `contact-file-delete:${file.id}`,
        payload: { key: file.storageKey, driver: file.storageDriver },
      },
      update: {},
    });
  }

  private async cleanStaged(files: ContactFile[]) {
    if (!files.length) return;
    await this.db.$transaction(async (tx) => {
      for (const file of files) {
        // A concurrent successful intake must never have its bytes removed.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM contact_files WHERE id = ${file.id}::uuid FOR UPDATE`,
        );
        const current = await tx.contactFile.findUnique({ where: { id: file.id } });
        if (current && !current.contactId) {
          await this.queueFileDelete(tx, current);
          await tx.contactFile.delete({ where: { id: current.id } });
        }
      }
    });
  }

  async contact(dto: ContactDto, files: UploadedFile[], ip: string): Promise<RelationshipAccepted> {
    if (
      files.length > CONTACT_FILE_COUNT_LIMIT ||
      files.reduce((sum, file) => sum + file.size, 0) > CONTACT_FILE_TOTAL_LIMIT
    )
      throw new PayloadTooLargeException({ code: 'CONTACT_FILES_LIMIT' });
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          state: dto.state,
          subject: dto.subject,
          message: dto.message,
          practiceAreaId: dto.practiceAreaId,
          privacyAccepted: dto.privacyAccepted,
          newsletterConsent: dto.newsletterConsent ?? false,
          files: files.map((file) => ({
            name: file.originalname,
            mime: file.mimetype,
            size: file.size,
            hash: createHash('sha256').update(file.buffer).digest('hex'),
          })),
        }),
      )
      .digest('hex');
    const previous = await this.db.contact.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return accepted;
    }
    await this.limiter.consume('contact-email', dto.email, 5);
    await this.turnstile.verify(dto.turnstileToken, 'contact', ip);
    if (
      dto.practiceAreaId &&
      !(await this.db.practiceArea.findFirst({ where: { id: dto.practiceAreaId, isActive: true } }))
    )
      throw new BadRequestException({ code: 'INVALID_RELATION' });
    const staged = await this.stage(files);
    try {
      await this.db.$transaction(
        async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`contact:${dto.idempotencyKey}`}))`,
          );
          const existing = await tx.contact.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) {
            if (existing.requestHash !== requestHash)
              throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
            return;
          }
          const contact = await tx.contact.create({
            data: {
              name: dto.name,
              email: dto.email,
              phone: dto.phone,
              state: dto.state,
              subject: dto.subject,
              message: dto.message,
              practiceAreaId: dto.practiceAreaId,
              privacyVersion: this.environment.PRIVACY_VERSION,
              consentedAt: new Date(),
              consentIpHash: relationshipHash(this.environment, ip),
              idempotencyKey: dto.idempotencyKey,
              requestHash,
              isMock: localRelationshipMocks(this.environment),
            },
          });
          for (const file of staged) {
            await tx.contactFile.update({
              where: { id: file.id },
              data: { contactId: contact.id, expiresAt: null },
            });
          }
          await queueEmail(
            tx,
            this.environment,
            {
              kind: 'contact',
              recipient:
                this.environment.CONTACT_NOTIFICATION_EMAIL ?? 'contato-ficticio@example.invalid',
              contactId: contact.id,
            },
            `contact-notification:${contact.id}`,
          );
          if (dto.newsletterConsent === true)
            await this.subscribeInTransaction(tx, dto.email, dto.name, ip);
        },
        { timeout: 10000 },
      );
      await this.cleanStaged(staged);
      return accepted;
    } catch (error) {
      await this.cleanStaged(staged).catch(() => undefined);
      throw error;
    }
  }

  private async subscribeInTransaction(
    tx: Prisma.TransactionClient,
    email: string,
    name: string | undefined,
    ip: string,
  ) {
    await this.emailLock(tx, email);
    const now = new Date();
    let subscriber = await tx.newsletterSubscriber.findUnique({ where: { email } });
    if (
      subscriber?.confirmationSentAt &&
      now.getTime() - subscriber.confirmationSentAt.getTime() < 10 * 60 * 1000
    )
      return;
    if (subscriber?.status === 'ACTIVE') {
      // The subscriber can request a fresh preferences link after expiry without
      // changing the original consent evidence or passing through activation again.
      await tx.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          confirmationSentAt: now,
          version: { increment: 1 },
        },
      });
      await tx.newsletterToken.updateMany({
        where: { subscriberId: subscriber.id, purpose: 'UNSUBSCRIBE', usedAt: null },
        data: { usedAt: now },
      });
      await tx.outboxTask.deleteMany({
        where: { idempotencyKey: { startsWith: `newsletter-unsubscribe:${subscriber.id}:` } },
      });
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(
        now.getTime() + this.environment.SUBSCRIBER_RETENTION_DAYS * 86400000,
      );
      await tx.newsletterToken.create({
        data: {
          subscriberId: subscriber.id,
          purpose: 'UNSUBSCRIBE',
          tokenHash: this.tokenHash(token),
          expiresAt,
        },
      });
      await queueEmail(
        tx,
        this.environment,
        {
          kind: 'newsletter-unsubscribe',
          recipient: email,
          token,
          expiresAt: expiresAt.toISOString(),
        },
        `newsletter-unsubscribe:${subscriber.id}:${this.tokenHash(token)}`,
      );
      return;
    }
    if (subscriber) {
      subscriber = await tx.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          name,
          status: 'PENDING',
          consentVersion: this.environment.NEWSLETTER_CONSENT_VERSION,
          consentedAt: now,
          consentIpHash: relationshipHash(this.environment, ip),
          confirmedAt: null,
          unsubscribedAt: null,
          confirmationSentAt: now,
          version: { increment: 1 },
        },
      });
    } else {
      subscriber = await tx.newsletterSubscriber.create({
        data: {
          email,
          name,
          consentVersion: this.environment.NEWSLETTER_CONSENT_VERSION,
          consentedAt: now,
          consentIpHash: relationshipHash(this.environment, ip),
          confirmationSentAt: now,
          isMock: localRelationshipMocks(this.environment),
        },
      });
    }
    await tx.newsletterToken.updateMany({
      where: { subscriberId: subscriber.id, usedAt: null },
      data: { usedAt: now },
    });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await tx.newsletterToken.create({
      data: {
        subscriberId: subscriber.id,
        purpose: 'CONFIRM',
        tokenHash: this.tokenHash(token),
        expiresAt,
      },
    });
    await queueEmail(
      tx,
      this.environment,
      { kind: 'newsletter-confirm', recipient: email, token, expiresAt: expiresAt.toISOString() },
      `newsletter-confirm:${subscriber.id}:${this.tokenHash(token)}`,
    );
  }

  async subscribe(dto: NewsletterSubscribeDto, ip: string): Promise<RelationshipAccepted> {
    await this.limiter.consume('newsletter-email', dto.email, 3, 60 * 60 * 1000);
    await this.turnstile.verify(dto.turnstileToken, 'newsletter', ip);
    await this.db.$transaction((tx) => this.subscribeInTransaction(tx, dto.email, dto.name, ip));
    return accepted;
  }

  async consumeNewsletterToken(
    token: string,
    purpose: 'CONFIRM' | 'UNSUBSCRIBE',
  ): Promise<RelationshipAccepted> {
    await this.db.$transaction(async (tx) => {
      const candidate = await tx.newsletterToken.findUnique({
        where: { tokenHash: this.tokenHash(token) },
        include: { subscriber: true },
      });
      if (!candidate || candidate.purpose !== purpose)
        throw new BadRequestException({ code: 'INVALID_NEWSLETTER_TOKEN' });
      await this.emailLock(tx, candidate.subscriber.email);
      const current = await tx.newsletterToken.findUnique({
        where: { id: candidate.id },
        include: { subscriber: true },
      });
      const now = new Date();
      if (
        !current ||
        current.usedAt ||
        current.expiresAt <= now ||
        current.subscriber.status !== (purpose === 'CONFIRM' ? 'PENDING' : 'ACTIVE')
      )
        throw new BadRequestException({ code: 'INVALID_NEWSLETTER_TOKEN' });
      await tx.newsletterToken.update({ where: { id: current.id }, data: { usedAt: now } });
      const subscriber = await tx.newsletterSubscriber.update({
        where: { id: current.subscriberId },
        data:
          purpose === 'CONFIRM'
            ? {
                status: 'ACTIVE',
                confirmedAt: now,
                unsubscribedAt: null,
                version: { increment: 1 },
              }
            : { status: 'UNSUBSCRIBED', unsubscribedAt: now, version: { increment: 1 } },
      });
      if (purpose === 'CONFIRM') {
        const unsubscribeToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(
          now.getTime() + this.environment.SUBSCRIBER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        );
        await tx.newsletterToken.create({
          data: {
            subscriberId: subscriber.id,
            purpose: 'UNSUBSCRIBE',
            tokenHash: this.tokenHash(unsubscribeToken),
            expiresAt,
          },
        });
        await queueEmail(
          tx,
          this.environment,
          {
            kind: 'newsletter-unsubscribe',
            recipient: subscriber.email,
            token: unsubscribeToken,
            expiresAt: expiresAt.toISOString(),
          },
          `newsletter-unsubscribe:${subscriber.id}:${this.tokenHash(unsubscribeToken)}`,
        );
      } else {
        await tx.newsletterToken.updateMany({
          where: { subscriberId: subscriber.id, usedAt: null },
          data: { usedAt: now },
        });
        await this.clearSubscriberMail(tx, subscriber.id);
        await queueEmail(
          tx,
          this.environment,
          { kind: 'newsletter-unsubscribe', recipient: subscriber.email },
          `newsletter-unsubscribe:${subscriber.id}:confirmation:${current.id}`,
        );
      }
    });
    return accepted;
  }

  async contacts(query: ContactQueryDto) {
    const where: Prisma.ContactWhereInput = {
      status: query.status,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { subject: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.contact.findMany({
        where,
        ...paging(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: contactInclude,
      }),
      this.db.contact.count({ where }),
    ]);
    return paginated(rows.map(contactView), total, query);
  }

  async contactDetail(id: string): Promise<AdminContact> {
    const row = await this.db.contact.findUnique({ where: { id }, include: contactInclude });
    if (!row) throw new NotFoundException();
    return contactView(row);
  }

  async setContactStatus(id: string, dto: ContactStatusDto, actor: SessionUser) {
    await this.db.$transaction(async (tx) => {
      const result = await tx.contact.updateMany({
        where: { id, version: dto.version },
        data: { status: dto.status, version: { increment: 1 } },
      });
      versionUpdated(result.count);
      await audit(tx, actor.id, 'contact.status', 'contact', id);
    });
    return this.contactDetail(id);
  }

  private async deleteContactTx(tx: Prisma.TransactionClient, id: string) {
    const files = await tx.contactFile.findMany({ where: { contactId: id } });
    for (const file of files) await this.queueFileDelete(tx, file);
    await tx.contactFile.deleteMany({ where: { contactId: id } });
    const legacy = await tx.contactAttachment.findMany({
      where: { contactId: id },
      include: { media: true },
    });
    await tx.contactAttachment.deleteMany({ where: { contactId: id } });
    for (const attachment of legacy) {
      await this.queueFileDelete(tx, {
        id: attachment.media.id,
        storageKey: attachment.media.storageKey,
        storageDriver: attachment.media.storageDriver,
      });
      await tx.media.delete({ where: { id: attachment.media.id } });
    }
    await tx.outboxTask.deleteMany({ where: { idempotencyKey: `contact-notification:${id}` } });
    await tx.contact.delete({ where: { id } });
  }

  async deleteContact(id: string, version: number, actor: SessionUser) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM contacts WHERE id = ${id}::uuid FOR UPDATE`);
      const contact = await tx.contact.findUnique({ where: { id } });
      if (!contact) throw new NotFoundException();
      if (contact.version !== version) throw new ConflictException({ code: 'VERSION_CONFLICT' });
      await this.deleteContactTx(tx, id);
      await audit(tx, actor.id, 'contact.delete', 'contact', id);
    });
    return { deleted: true };
  }

  private scannerAllows(file: ContactFile) {
    return (
      file.scanStatus === 'VERIFIED' ||
      (file.scanStatus === 'LOCAL_VERIFIED' && localRelationshipMocks(this.environment))
    );
  }

  async issueDownload(
    contactId: string,
    fileId: string,
    actor: SessionUser,
  ): Promise<ContactDownloadIssued> {
    const file = await this.db.contactFile.findFirst({ where: { id: fileId, contactId } });
    if (!file) throw new NotFoundException();
    if (!this.scannerAllows(file)) throw new ForbiddenException({ code: 'ATTACHMENT_QUARANTINED' });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60000);
    await this.db.contactDownloadTicket.create({
      data: {
        fileId,
        adminId: actor.id,
        sessionId: actor.sessionId,
        tokenHash: this.tokenHash(token),
        expiresAt,
      },
    });
    return { url: `/api/v1/admin/contact-downloads/${token}`, expiresAt: expiresAt.toISOString() };
  }

  async download(token: string, actor: SessionUser) {
    if (!/^[a-f0-9]{64}$/u.test(token)) throw new NotFoundException();
    const file = await this.db.$transaction(async (tx) => {
      const tokenHash = this.tokenHash(token);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM contact_download_tickets WHERE token_hash = ${tokenHash} FOR UPDATE`,
      );
      const ticket = await tx.contactDownloadTicket.findUnique({
        where: { tokenHash },
        include: { file: true },
      });
      if (
        !ticket ||
        ticket.adminId !== actor.id ||
        ticket.sessionId !== actor.sessionId ||
        ticket.usedAt ||
        ticket.expiresAt <= new Date() ||
        !ticket.file.contactId
      )
        throw new NotFoundException();
      if (!this.scannerAllows(ticket.file))
        throw new ForbiddenException({ code: 'ATTACHMENT_QUARANTINED' });
      await tx.contactDownloadTicket.update({
        where: { id: ticket.id },
        data: { usedAt: new Date() },
      });
      await audit(tx, actor.id, 'contact.download', 'contact-file', ticket.file.id);
      return ticket.file;
    });
    return {
      bytes: await this.storage.get(file.storageKey, 'PRIVATE', file.storageDriver),
      filename: file.filename,
      mimeType: file.mimeType,
    };
  }

  private subscriberWhere(query: SubscriberQueryDto): Prisma.NewsletterSubscriberWhereInput {
    return {
      status: query.status,
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  async subscribers(query: SubscriberQueryDto) {
    const where = this.subscriberWhere(query);
    const [rows, total] = await this.db.$transaction([
      this.db.newsletterSubscriber.findMany({
        where,
        ...paging(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.newsletterSubscriber.count({ where }),
    ]);
    return paginated(rows.map(subscriberView), total, query);
  }

  private async clearSubscriberMail(tx: Prisma.TransactionClient, id: string) {
    await tx.outboxTask.deleteMany({
      where: {
        OR: [
          { idempotencyKey: { startsWith: `newsletter-confirm:${id}:` } },
          { idempotencyKey: { startsWith: `newsletter-unsubscribe:${id}:` } },
        ],
      },
    });
  }

  async deleteSubscriber(id: string, version: number, actor: SessionUser) {
    await this.db.$transaction(async (tx) => {
      const subscriber = await tx.newsletterSubscriber.findUnique({ where: { id } });
      if (!subscriber) throw new NotFoundException();
      await this.emailLock(tx, subscriber.email);
      const removed = await tx.newsletterSubscriber.deleteMany({ where: { id, version } });
      versionUpdated(removed.count);
      await this.clearSubscriberMail(tx, id);
      await audit(tx, actor.id, 'subscriber.delete', 'subscriber', id);
    });
    return { deleted: true };
  }

  async exportSubscribers(query: SubscriberQueryDto, actor: SessionUser): Promise<string> {
    const where = this.subscriberWhere(query);
    const rows = await this.db.newsletterSubscriber.findMany({
      where,
      take: 10001,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    if (rows.length > 10000) throw new PayloadTooLargeException({ code: 'EXPORT_LIMIT_EXCEEDED' });
    await this.db.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'subscriber.export',
        resource: 'subscriber',
        metadata: { count: rows.length },
      },
    });
    const cell = (value: string | null) => {
      const text = (value ?? '').replace(/[\x00-\x1f\x7f]/gu, ' ');
      return `"${(/^[\s]*[=+\-@]/u.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
    };
    return (
      '\uFEFF' +
      [
        ['email', 'nome', 'status', 'consentimento', 'confirmado_em'],
        ...rows.map((row) => [
          row.email,
          row.name,
          row.status,
          row.consentVersion,
          row.confirmedAt?.toISOString() ?? null,
        ]),
      ]
        .map((row) => row.map(cell).join(','))
        .join('\r\n') +
      '\r\n'
    );
  }

  /** Bounded, serialized retention; object deletion is durable before metadata disappears. */
  async purgeExpired(
    now = new Date(),
  ): Promise<{ contacts: number; subscribers: number; temporaryFiles: number }> {
    return this.db.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(7070042026::bigint) AS locked`;
        if (!locked[0]?.locked) return { contacts: 0, subscribers: 0, temporaryFiles: 0 };
        const contactExpiry = new Date(
          now.getTime() - this.environment.CONTACT_RETENTION_DAYS * 86400000,
        );
        const subscriberExpiry = new Date(
          now.getTime() - this.environment.SUBSCRIBER_RETENTION_DAYS * 86400000,
        );
        const contacts = await tx.contact.findMany({
          where: { createdAt: { lt: contactExpiry } },
          take: 100,
          select: { id: true },
        });
        for (const { id } of contacts) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM contacts WHERE id = ${id}::uuid FOR UPDATE`);
          if (await tx.contact.findUnique({ where: { id } })) await this.deleteContactTx(tx, id);
        }
        const subscribers = await tx.newsletterSubscriber.findMany({
          where: {
            status: { in: ['PENDING', 'UNSUBSCRIBED'] },
            updatedAt: { lt: subscriberExpiry },
          },
          take: 100,
          select: { id: true, email: true },
        });
        let subscriberCount = 0;
        for (const subscriber of subscribers) {
          await this.emailLock(tx, subscriber.email);
          const result = await tx.newsletterSubscriber.deleteMany({
            where: {
              id: subscriber.id,
              status: { in: ['PENDING', 'UNSUBSCRIBED'] },
              updatedAt: { lt: subscriberExpiry },
            },
          });
          subscriberCount += result.count;
          if (result.count) await this.clearSubscriberMail(tx, subscriber.id);
        }
        const temporary = await tx.contactFile.findMany({
          where: { contactId: null, expiresAt: { lte: now } },
          take: 100,
        });
        let temporaryCount = 0;
        for (const file of temporary) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM contact_files WHERE id = ${file.id}::uuid FOR UPDATE`,
          );
          const current = await tx.contactFile.findUnique({ where: { id: file.id } });
          if (current && !current.contactId && current.expiresAt && current.expiresAt <= now) {
            await this.queueFileDelete(tx, current);
            await tx.contactFile.delete({ where: { id: current.id } });
            temporaryCount++;
          }
        }
        await tx.contactDownloadTicket.deleteMany({ where: { expiresAt: { lte: now } } });
        await tx.newsletterToken.deleteMany({ where: { expiresAt: { lte: now } } });
        await tx.loginRateLimit.deleteMany({
          where: {
            key: { startsWith: 'relationship:' },
            windowStart: { lt: new Date(now.getTime() - 86400000) },
            OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
          },
        });
        return {
          contacts: contacts.length,
          subscribers: subscriberCount,
          temporaryFiles: temporaryCount,
        };
      },
      { timeout: 20000 },
    );
  }
}
