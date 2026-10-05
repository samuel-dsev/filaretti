import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import type { AdminMedia } from '@filaretti/types';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../auth/types';
import {
  audit,
  databaseWrite,
  DOMAIN_ENVIRONMENT,
  exists,
  paginated,
  paging,
  requireSort,
  versionUpdated,
} from '../domain/shared';
import { StorageService, storageKeyPattern } from './storage.service';
import { validateUpload, type UploadedFile } from './upload';
import type { MediaPatchDto, MediaQueryDto, MediaUploadDto } from './dto';
import { queueRevalidation } from './outbox';

type Actor = AuthenticatedRequest['user'];
const include = {
  _count: {
    select: {
      articleCovers: true,
      articlePdfs: true,
      professionals: true,
      contactAttachments: true,
    },
  },
} satisfies Prisma.MediaInclude;
type Record = Prisma.MediaGetPayload<{ include: typeof include }>;
function referenceCount(row: Record) {
  return Object.values(row._count).reduce((sum, count) => sum + count, 0);
}
function serialize(row: Record): AdminMedia {
  return {
    id: row.id,
    ownerId: row.ownerId,
    visibility: row.visibility,
    url: row.visibility === 'PUBLIC' && row._count.contactAttachments === 0 ? row.publicUrl : null,
    mimeType: row.mimeType,
    size: row.size,
    alt: row.alt,
    source: row.source,
    license: row.license,
    version: row.version,
    references: referenceCount(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
@Injectable()
export class MediaService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  private authorize(row: Record, actor: Actor) {
    if (
      row._count.contactAttachments ||
      (actor.role === UserRole.AUTHOR && row.ownerId !== actor.id)
    )
      throw new ForbiddenException({ code: 'CONTENT_FORBIDDEN' });
  }
  async list(query: MediaQueryDto, actor: Actor) {
    requireSort(query, ['newest', 'oldest'], 'newest');
    const where: Prisma.MediaWhereInput = {
      contactAttachments: { none: {} },
      ...(actor.role === UserRole.AUTHOR ? { ownerId: actor.id } : {}),
      ...(query.kind
        ? { mimeType: query.kind === 'pdf' ? 'application/pdf' : { startsWith: 'image/' } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { alt: { contains: query.q, mode: 'insensitive' } },
              { source: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.media.findMany({
        where,
        include,
        ...paging(query),
        orderBy: [{ createdAt: query.sort === 'oldest' ? 'asc' : 'desc' }, { id: 'asc' }],
      }),
      this.db.media.count({ where }),
    ]);
    return paginated(rows.map(serialize), total, query);
  }
  async detail(id: string, actor: Actor) {
    const row = exists(await this.db.media.findUnique({ where: { id }, include }));
    this.authorize(row, actor);
    return serialize(row);
  }
  async upload(file: UploadedFile | undefined, dto: MediaUploadDto, actor: Actor) {
    const asset = await validateUpload(file);
    const visibility = dto.visibility ?? 'PUBLIC';
    const key = `${randomUUID()}.${asset.extension}`;
    await this.storage.put(key, visibility, asset.mimeType, asset.bytes);
    try {
      return await databaseWrite(() =>
        this.db.$transaction(async (tx) => {
          const row = await tx.media.create({
            data: {
              ownerId: actor.id,
              visibility,
              storageKey: key,
              storageDriver: this.environment.STORAGE_DRIVER,
              publicUrl: visibility === 'PUBLIC' ? `/media/public/${key}` : null,
              mimeType: asset.mimeType,
              size: asset.bytes.length,
              alt: dto.alt,
              source: dto.source,
              license: dto.license,
              isMock: this.environment.MOCK_CONTENT,
            },
            include,
          });
          await audit(tx, actor.id, 'media.created', 'media', row.id);
          return serialize(row);
        }),
      );
    } catch (error) {
      await this.storage
        .remove(key, visibility, this.environment.STORAGE_DRIVER)
        .catch(() => undefined);
      throw error;
    }
  }
  async update(id: string, dto: MediaPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const row = exists(await tx.media.findUnique({ where: { id }, include }));
        this.authorize(row, actor);
        versionUpdated(
          (
            await tx.media.updateMany({
              where: { id, version: dto.version },
              data: {
                alt: dto.alt,
                source: dto.source,
                license: dto.license,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, 'media.updated', 'media', id);
        await queueRevalidation(tx);
        return serialize(exists(await tx.media.findUnique({ where: { id }, include })));
      }),
    );
  }
  async remove(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(
        async (tx) => {
          const row = exists(await tx.media.findUnique({ where: { id }, include }));
          this.authorize(row, actor);
          // TipTap links can reference a public asset without a relational media ID.
          const pattern = `%${row.storageKey}%`;
          const links = await tx.$queryRaw<{ inUse: boolean }[]>`SELECT EXISTS (
            SELECT 1 FROM articles WHERE content::text LIKE ${pattern}
            UNION ALL SELECT 1 FROM pages WHERE sections::text LIKE ${pattern}
            UNION ALL SELECT 1 FROM professionals WHERE bio::text LIKE ${pattern}
            UNION ALL SELECT 1 FROM practice_areas WHERE description::text LIKE ${pattern}
            UNION ALL SELECT 1 FROM faqs WHERE answer::text LIKE ${pattern}
          ) AS "inUse"`;
          if (referenceCount(row) || links[0]?.inUse)
            throw new ConflictException({ code: 'RESOURCE_IN_USE' });
          versionUpdated((await tx.media.deleteMany({ where: { id, version } })).count);
          await tx.outboxTask.create({
            data: {
              topic: 'media.delete',
              idempotencyKey: `media-delete:${id}`,
              payload: {
                key: row.storageKey,
                driver: row.storageDriver,
                visibility: row.visibility,
              },
            },
          });
          await audit(tx, actor.id, 'media.deleted', 'media', id);
          return { deleted: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async publicAsset(key: string) {
    if (!storageKeyPattern.test(key)) throw new NotFoundException();
    const row = await this.db.media.findFirst({
      where: {
        storageKey: key,
        visibility: 'PUBLIC',
        contactAttachments: { none: {} },
        ...(this.environment.APP_ENV === 'production' ? { isMock: false } : {}),
      },
    });
    if (!row || row.publicUrl !== `/media/public/${key}`) throw new NotFoundException();
    return {
      bytes: await this.storage.get(key, row.visibility, row.storageDriver),
      mimeType: row.mimeType,
    };
  }
}
