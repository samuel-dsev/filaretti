import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  PublicationStatus,
  type Category,
  type Page,
  type Redirect,
  type SiteSetting,
} from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import type {
  PublicFaq,
  PublicPage,
  PublicPracticeArea,
  PublicProfessional,
  PublicSiteSettings,
} from '@filaretti/types';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../auth/types';
import type {
  FaqDto,
  FaqPatchDto,
  FaqQueryDto,
  PageDto,
  PagePatchDto,
  PaginationDto,
  PracticeAreaDto,
  PracticeAreaPatchDto,
  ProfessionalDto,
  ProfessionalPatchDto,
  PublicationDto,
  RedirectDto,
  RedirectPatchDto,
  SettingsPatchDto,
  TaxonomyDto,
  TaxonomyPatchDto,
} from './dto';
import { publicContent, publicSections, safeUrl } from './content';
import { professionalSummary } from './articles.service';
import {
  audit as domainAudit,
  databaseWrite,
  DOMAIN_ENVIRONMENT,
  exists,
  json,
  paginated,
  paging,
  publicMediaInclude,
  requireSort,
  strings,
  taxonomy,
  validateMedia,
  validateRelations,
  versionUpdated,
} from './shared';
import { queueRevalidation } from '../cms/outbox';
import { preserveSlug, redirectPath, validateRedirectGraph } from '../cms/redirects';

async function audit(
  tx: Prisma.TransactionClient,
  actor: string,
  action: string,
  resource: string,
  id: string,
) {
  await domainAudit(tx, actor, action, resource, id);
  await queueRevalidation(tx);
}

type Actor = AuthenticatedRequest['user'];
type TaxonomyKind = 'category' | 'tag';
const professionalInclude = {
  photoMedia: publicMediaInclude,
  practiceAreas: { include: { practiceArea: true } },
} satisfies Prisma.ProfessionalInclude;
const areaInclude = {
  professionals: { include: { professional: { include: { photoMedia: publicMediaInclude } } } },
} satisfies Prisma.PracticeAreaInclude;
const faqInclude = { practiceArea: true } satisfies Prisma.FaqInclude;
type ProfessionalRecord = Prisma.ProfessionalGetPayload<{ include: typeof professionalInclude }>;
type AreaRecord = Prisma.PracticeAreaGetPayload<{ include: typeof areaInclude }>;
type FaqRecord = Prisma.FaqGetPayload<{ include: typeof faqInclude }>;
function professional(record: ProfessionalRecord): PublicProfessional {
  return {
    ...professionalSummary(record),
    bio: publicContent(record.bio),
    education: strings(record.education),
    experience: strings(record.experience),
    practiceAreas: record.practiceAreas
      .filter((row) => row.practiceArea.isActive)
      .map((row) => taxonomy(row.practiceArea)),
  };
}
function professionalAdmin(record: ProfessionalRecord) {
  return {
    ...professional(record),
    photoMediaId: record.photoMediaId,
    practiceAreaIds: record.practiceAreas.map((row) => row.practiceAreaId),
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    version: record.version,
    isMock: record.isMock,
  };
}
function area(record: AreaRecord): PublicPracticeArea {
  return {
    ...taxonomy(record),
    summary: record.summary,
    description: publicContent(record.description),
    services: strings(record.services),
    professionals: record.professionals
      .filter((row) => row.professional.isActive)
      .map((row) => professionalSummary(row.professional)),
  };
}
function areaAdmin(record: AreaRecord) {
  return {
    ...area(record),
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    version: record.version,
    isMock: record.isMock,
  };
}
function page(record: Page): PublicPage {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    sections: publicSections(record.sections),
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
  };
}
function pageAdmin(record: Page) {
  return {
    ...page(record),
    status: record.status,
    version: record.version,
    isMock: record.isMock,
    publishedAt: record.publishedAt?.toISOString() ?? null,
  };
}
function faq(record: FaqRecord): PublicFaq {
  return {
    id: record.id,
    question: record.question,
    answer: publicContent(record.answer),
    practiceArea: record.practiceArea?.isActive ? taxonomy(record.practiceArea) : null,
  };
}
function faqAdmin(record: FaqRecord) {
  return {
    ...faq(record),
    practiceAreaId: record.practiceAreaId,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    version: record.version,
    isMock: record.isMock,
  };
}
function taxonomyAdmin(record: Category) {
  return {
    ...taxonomy(record),
    isActive: record.isActive,
    version: record.version,
    isMock: record.isMock,
  };
}
function settings(record: SiteSetting): PublicSiteSettings {
  const address: Record<string, string> = {};
  if (
    typeof record.address === 'object' &&
    record.address !== null &&
    !Array.isArray(record.address)
  ) {
    for (const key of ['street', 'city', 'state', 'postalCode', 'country']) {
      const value = record.address[key];
      if (typeof value === 'string') address[key] = value;
    }
  }
  const socialLinks: { label: string; url: string }[] = [];
  if (Array.isArray(record.socialLinks)) {
    for (const item of record.socialLinks) {
      if (
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item) &&
        typeof item.label === 'string' &&
        safeUrl(item.url)
      )
        socialLinks.push({ label: item.label, url: item.url });
    }
  }
  return {
    siteName: record.siteName,
    publicEmail: record.publicEmail,
    publicPhone: record.publicPhone,
    whatsappUrl: safeUrl(record.whatsappUrl) ? record.whatsappUrl : null,
    address,
    socialLinks,
  };
}
function redirect(record: Redirect) {
  return {
    sourcePath: record.sourcePath,
    targetPath: record.targetPath,
    statusCode: record.statusCode,
  };
}
function redirectAdmin(record: Redirect) {
  return { id: record.id, ...redirect(record), isActive: record.isActive, version: record.version };
}
function alphabeticalOrder(
  query: PaginationDto,
  hasOrder = false,
): { name?: Prisma.SortOrder; sortOrder?: Prisma.SortOrder; id?: Prisma.SortOrder }[] {
  const sort = requireSort(
    query,
    hasOrder ? ['name', 'order'] : ['name'],
    hasOrder ? 'order' : 'name',
  );
  return [sort === 'order' ? { sortOrder: 'asc' } : { name: 'asc' }, { id: 'asc' }];
}
function documentOrder(query: PaginationDto): Prisma.PageOrderByWithRelationInput[] {
  const sort = requireSort(query, ['newest', 'oldest', 'title'], 'title');
  return [
    sort === 'title' ? { title: 'asc' } : { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
    { id: 'asc' },
  ];
}

@Injectable()
export class InstitutionService {
  constructor(
    private readonly db: PrismaService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}
  async listTaxonomies(kind: TaxonomyKind, query: PaginationDto, administrative = false) {
    const where = administrative ? {} : { isActive: true };
    const options = { where, ...paging(query), orderBy: alphabeticalOrder(query) };
    const [rows, total] =
      kind === 'category'
        ? await this.db.$transaction([
            this.db.category.findMany(options),
            this.db.category.count({ where }),
          ])
        : await this.db.$transaction([this.db.tag.findMany(options), this.db.tag.count({ where })]);
    return paginated(rows.map(administrative ? taxonomyAdmin : taxonomy), total, query);
  }
  async taxonomyDetail(kind: TaxonomyKind, key: string, administrative = false) {
    const where = administrative ? { id: key } : { slug: key, isActive: true };
    const row = exists(
      kind === 'category'
        ? await this.db.category.findFirst({ where })
        : await this.db.tag.findFirst({ where }),
    );
    return administrative ? taxonomyAdmin(row) : taxonomy(row);
  }
  async createTaxonomy(kind: TaxonomyKind, dto: TaxonomyDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const data = {
          name: dto.name,
          slug: dto.slug,
          isActive: dto.isActive,
          isMock: this.environment.MOCK_CONTENT,
        };
        const row =
          kind === 'category' ? await tx.category.create({ data }) : await tx.tag.create({ data });
        await audit(tx, actor.id, `${kind}.created`, kind, row.id);
        return taxonomyAdmin(row);
      }),
    );
  }
  async updateTaxonomy(kind: TaxonomyKind, id: string, dto: TaxonomyPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(
          kind === 'category'
            ? await tx.category.findUnique({ where: { id } })
            : await tx.tag.findUnique({ where: { id } }),
        );
        const where = { id, version: dto.version };
        const data = {
          name: dto.name,
          slug: dto.slug,
          isActive: dto.isActive,
          version: { increment: 1 },
        };
        versionUpdated(
          (kind === 'category'
            ? await tx.category.updateMany({ where, data })
            : await tx.tag.updateMany({ where, data })
          ).count,
        );
        await audit(tx, actor.id, `${kind}.updated`, kind, id);
        return taxonomyAdmin(
          exists(
            kind === 'category'
              ? await tx.category.findUnique({ where: { id } })
              : await tx.tag.findUnique({ where: { id } }),
          ),
        );
      }),
    );
  }
  async removeTaxonomy(kind: TaxonomyKind, id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(
          kind === 'category'
            ? await tx.category.findUnique({ where: { id } })
            : await tx.tag.findUnique({ where: { id } }),
        );
        const where = { id, version };
        versionUpdated(
          (kind === 'category'
            ? await tx.category.deleteMany({ where })
            : await tx.tag.deleteMany({ where })
          ).count,
        );
        await audit(tx, actor.id, `${kind}.deleted`, kind, id);
        return { deleted: true };
      }),
    );
  }
  async professionals(query: PaginationDto, administrative = false) {
    const where = administrative ? {} : { isActive: true };
    const [rows, total] = await this.db.$transaction([
      this.db.professional.findMany({
        where,
        include: professionalInclude,
        ...paging(query),
        orderBy: alphabeticalOrder(query, true),
      }),
      this.db.professional.count({ where }),
    ]);
    return paginated(rows.map(administrative ? professionalAdmin : professional), total, query);
  }
  async professionalDetail(key: string, administrative = false) {
    const row = exists(
      await this.db.professional.findFirst({
        where: administrative ? { id: key } : { slug: key, isActive: true },
        include: professionalInclude,
      }),
    );
    return administrative ? professionalAdmin(row) : professional(row);
  }
  async createProfessional(dto: ProfessionalDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        if (await tx.redirect.findUnique({ where: { sourcePath: `/profissionais/${dto.slug}` } }))
          throw new BadRequestException({ code: 'SLUG_RESERVED' });
        await validateRelations(tx, dto);
        await validateMedia(tx, dto.photoMediaId, 'image');
        const row = await tx.professional.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            title: dto.title,
            bio: json(dto.bio),
            education: json(dto.education),
            experience: json(dto.experience),
            photoMediaId: dto.photoMediaId,
            isActive: dto.isActive,
            sortOrder: dto.sortOrder,
            isMock: this.environment.MOCK_CONTENT,
            practiceAreas: {
              create: (dto.practiceAreaIds ?? []).map((practiceAreaId) => ({ practiceAreaId })),
            },
          },
          include: professionalInclude,
        });
        await audit(tx, actor.id, 'professional.created', 'professional', row.id);
        return professionalAdmin(row);
      }),
    );
  }
  async updateProfessional(id: string, dto: ProfessionalPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        const current = exists(await tx.professional.findUnique({ where: { id } }));
        if (dto.slug && dto.slug !== current.slug)
          await preserveSlug(
            tx,
            `/profissionais/${current.slug}`,
            `/profissionais/${dto.slug}`,
            current.isActive && dto.isActive !== false,
          );
        await validateRelations(tx, dto);
        await validateMedia(tx, dto.photoMediaId, 'image');
        versionUpdated(
          (
            await tx.professional.updateMany({
              where: { id, version: dto.version },
              data: {
                name: dto.name,
                slug: dto.slug,
                title: dto.title,
                ...(dto.bio === undefined ? {} : { bio: json(dto.bio) }),
                ...(dto.education === undefined ? {} : { education: json(dto.education) }),
                ...(dto.experience === undefined ? {} : { experience: json(dto.experience) }),
                photoMediaId: dto.photoMediaId,
                isActive: dto.isActive,
                sortOrder: dto.sortOrder,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        if (dto.practiceAreaIds) {
          await tx.professionalPracticeArea.deleteMany({ where: { professionalId: id } });
          await tx.professionalPracticeArea.createMany({
            data: dto.practiceAreaIds.map((practiceAreaId) => ({
              professionalId: id,
              practiceAreaId,
            })),
          });
        }
        await audit(tx, actor.id, 'professional.updated', 'professional', id);
        return professionalAdmin(
          exists(await tx.professional.findUnique({ where: { id }, include: professionalInclude })),
        );
      }),
    );
  }
  async removeProfessional(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.professional.findUnique({ where: { id } }));
        versionUpdated((await tx.professional.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'professional.deleted', 'professional', id);
        return { deleted: true };
      }),
    );
  }
  async areas(query: PaginationDto, administrative = false) {
    const where = administrative ? {} : { isActive: true };
    const [rows, total] = await this.db.$transaction([
      this.db.practiceArea.findMany({
        where,
        include: areaInclude,
        ...paging(query),
        orderBy: alphabeticalOrder(query, true),
      }),
      this.db.practiceArea.count({ where }),
    ]);
    return paginated(rows.map(administrative ? areaAdmin : area), total, query);
  }
  async areaDetail(key: string, administrative = false) {
    const row = exists(
      await this.db.practiceArea.findFirst({
        where: administrative ? { id: key } : { slug: key, isActive: true },
        include: areaInclude,
      }),
    );
    return administrative ? areaAdmin(row) : area(row);
  }
  async createArea(dto: PracticeAreaDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        if (
          await tx.redirect.findUnique({ where: { sourcePath: `/areas-de-atuacao/${dto.slug}` } })
        )
          throw new BadRequestException({ code: 'SLUG_RESERVED' });
        const row = await tx.practiceArea.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            summary: dto.summary,
            description: json(dto.description),
            services: json(dto.services),
            isActive: dto.isActive,
            sortOrder: dto.sortOrder,
            isMock: this.environment.MOCK_CONTENT,
          },
          include: areaInclude,
        });
        await audit(tx, actor.id, 'practiceArea.created', 'practiceArea', row.id);
        return areaAdmin(row);
      }),
    );
  }
  async updateArea(id: string, dto: PracticeAreaPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        const current = exists(await tx.practiceArea.findUnique({ where: { id } }));
        if (dto.slug && dto.slug !== current.slug)
          await preserveSlug(
            tx,
            `/areas-de-atuacao/${current.slug}`,
            `/areas-de-atuacao/${dto.slug}`,
            current.isActive && dto.isActive !== false,
          );
        versionUpdated(
          (
            await tx.practiceArea.updateMany({
              where: { id, version: dto.version },
              data: {
                name: dto.name,
                slug: dto.slug,
                summary: dto.summary,
                ...(dto.description === undefined ? {} : { description: json(dto.description) }),
                ...(dto.services === undefined ? {} : { services: json(dto.services) }),
                isActive: dto.isActive,
                sortOrder: dto.sortOrder,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, 'practiceArea.updated', 'practiceArea', id);
        return areaAdmin(
          exists(await tx.practiceArea.findUnique({ where: { id }, include: areaInclude })),
        );
      }),
    );
  }
  async removeArea(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.practiceArea.findUnique({ where: { id } }));
        versionUpdated((await tx.practiceArea.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'practiceArea.deleted', 'practiceArea', id);
        return { deleted: true };
      }),
    );
  }
  async pages(query: PaginationDto, administrative = false) {
    const where: Prisma.PageWhereInput = administrative
      ? {}
      : { status: PublicationStatus.PUBLISHED, publishedAt: { lte: new Date() } };
    const [rows, total] = await this.db.$transaction([
      this.db.page.findMany({ where, ...paging(query), orderBy: documentOrder(query) }),
      this.db.page.count({ where }),
    ]);
    return paginated(rows.map(administrative ? pageAdmin : page), total, query);
  }
  async pageDetail(key: string, administrative = false) {
    const row = exists(
      await this.db.page.findFirst({
        where: administrative
          ? { id: key }
          : { slug: key, status: PublicationStatus.PUBLISHED, publishedAt: { lte: new Date() } },
      }),
    );
    return administrative ? pageAdmin(row) : page(row);
  }
  async createPage(dto: PageDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        if (await tx.redirect.findUnique({ where: { sourcePath: `/${dto.slug}` } }))
          throw new BadRequestException({ code: 'SLUG_RESERVED' });
        const row = await tx.page.create({
          data: {
            title: dto.title,
            slug: dto.slug,
            sections: json(dto.sections),
            seoTitle: dto.seoTitle,
            seoDescription: dto.seoDescription,
            isMock: this.environment.MOCK_CONTENT,
          },
        });
        await audit(tx, actor.id, 'page.created', 'page', row.id);
        return pageAdmin(row);
      }),
    );
  }
  async updatePage(id: string, dto: PagePatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
        const current = exists(await tx.page.findUnique({ where: { id } }));
        if (dto.slug && dto.slug !== current.slug) {
          if (['home', 'o-escritorio', 'privacidade', 'cookies'].includes(current.slug))
            throw new BadRequestException({ code: 'INVALID_CONTENT' });
          await preserveSlug(
            tx,
            `/${current.slug}`,
            `/${dto.slug}`,
            current.status === PublicationStatus.PUBLISHED &&
              current.publishedAt !== null &&
              current.publishedAt <= new Date(),
          );
        }
        versionUpdated(
          (
            await tx.page.updateMany({
              where: { id, version: dto.version },
              data: {
                title: dto.title,
                slug: dto.slug,
                ...(dto.sections === undefined ? {} : { sections: json(dto.sections) }),
                seoTitle: dto.seoTitle,
                seoDescription: dto.seoDescription,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, 'page.updated', 'page', id);
        return pageAdmin(exists(await tx.page.findUnique({ where: { id } })));
      }),
    );
  }
  async publishPage(id: string, dto: PublicationDto, actor: Actor) {
    if (dto.status === 'SCHEDULED' || dto.scheduledAt !== undefined)
      throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const row = exists(await tx.page.findUnique({ where: { id } }));
        if (dto.status === 'PUBLISHED' && publicSections(row.sections).length === 0)
          throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
        versionUpdated(
          (
            await tx.page.updateMany({
              where: { id, version: dto.version },
              data: {
                status: dto.status,
                publishedAt: dto.status === 'PUBLISHED' ? (row.publishedAt ?? new Date()) : null,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, `page.${dto.status.toLowerCase()}`, 'page', id);
        return pageAdmin(exists(await tx.page.findUnique({ where: { id } })));
      }),
    );
  }
  async resolveRedirect(path: string) {
    if (!redirectPath(path)) throw new BadRequestException();
    const row = exists(
      await this.db.redirect.findFirst({ where: { sourcePath: path, isActive: true } }),
    );
    if (!redirectPath(row.targetPath)) throw new BadRequestException();
    return redirect(row);
  }
  async removePage(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        const row = exists(await tx.page.findUnique({ where: { id } }));
        if (row.status === PublicationStatus.PUBLISHED)
          throw new BadRequestException({ code: 'INVALID_PUBLICATION' });
        versionUpdated((await tx.page.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'page.deleted', 'page', id);
        return { deleted: true };
      }),
    );
  }
  async faqs(query: FaqQueryDto, administrative = false) {
    requireSort(query, ['order'], 'order');
    const where: Prisma.FaqWhereInput = {
      ...(administrative
        ? {}
        : { isActive: true, OR: [{ practiceAreaId: null }, { practiceArea: { isActive: true } }] }),
      ...(query.area ? { practiceArea: { slug: query.area, isActive: true } } : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.faq.findMany({
        where,
        include: faqInclude,
        ...paging(query),
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.db.faq.count({ where }),
    ]);
    return paginated(rows.map(administrative ? faqAdmin : faq), total, query);
  }
  async faqDetail(id: string, administrative = false) {
    const row = exists(
      await this.db.faq.findFirst({
        where: {
          id,
          ...(administrative
            ? {}
            : {
                isActive: true,
                OR: [{ practiceAreaId: null }, { practiceArea: { isActive: true } }],
              }),
        },
        include: faqInclude,
      }),
    );
    return administrative ? faqAdmin(row) : faq(row);
  }
  async createFaq(dto: FaqDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        await validateRelations(tx, {
          practiceAreaIds: dto.practiceAreaId ? [dto.practiceAreaId] : [],
        });
        const row = await tx.faq.create({
          data: {
            question: dto.question,
            answer: json(dto.answer),
            practiceAreaId: dto.practiceAreaId,
            isActive: dto.isActive,
            sortOrder: dto.sortOrder,
            isMock: this.environment.MOCK_CONTENT,
          },
          include: faqInclude,
        });
        await audit(tx, actor.id, 'faq.created', 'faq', row.id);
        return faqAdmin(row);
      }),
    );
  }
  async updateFaq(id: string, dto: FaqPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.faq.findUnique({ where: { id } }));
        await validateRelations(tx, {
          practiceAreaIds: dto.practiceAreaId ? [dto.practiceAreaId] : [],
        });
        versionUpdated(
          (
            await tx.faq.updateMany({
              where: { id, version: dto.version },
              data: {
                question: dto.question,
                ...(dto.answer === undefined ? {} : { answer: json(dto.answer) }),
                practiceAreaId: dto.practiceAreaId,
                isActive: dto.isActive,
                sortOrder: dto.sortOrder,
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, 'faq.updated', 'faq', id);
        return faqAdmin(exists(await tx.faq.findUnique({ where: { id }, include: faqInclude })));
      }),
    );
  }
  async removeFaq(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.faq.findUnique({ where: { id } }));
        versionUpdated((await tx.faq.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'faq.deleted', 'faq', id);
        return { deleted: true };
      }),
    );
  }
  async settings(administrative = false) {
    const row = exists(await this.db.siteSetting.findUnique({ where: { id: 'site' } }));
    return administrative
      ? { ...settings(row), version: row.version, isMock: row.isMock }
      : settings(row);
  }
  async updateSettings(dto: SettingsPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.siteSetting.findUnique({ where: { id: 'site' } }));
        versionUpdated(
          (
            await tx.siteSetting.updateMany({
              where: { id: 'site', version: dto.version },
              data: {
                siteName: dto.siteName,
                publicEmail: dto.publicEmail,
                publicPhone: dto.publicPhone,
                whatsappUrl: dto.whatsappUrl,
                ...(dto.address === undefined ? {} : { address: json(dto.address) }),
                ...(dto.socialLinks === undefined ? {} : { socialLinks: json(dto.socialLinks) }),
                version: { increment: 1 },
              },
            })
          ).count,
        );
        await audit(tx, actor.id, 'settings.updated', 'settings', 'site');
        const row = exists(await tx.siteSetting.findUnique({ where: { id: 'site' } }));
        return { ...settings(row), version: row.version, isMock: row.isMock };
      }),
    );
  }
  async redirects(query: PaginationDto, administrative = false) {
    requireSort(query, ['newest', 'oldest'], 'newest');
    const where = administrative ? {} : { isActive: true };
    const [rows, total] = await this.db.$transaction([
      this.db.redirect.findMany({
        where,
        ...paging(query),
        orderBy: [{ createdAt: query.sort === 'oldest' ? 'asc' : 'desc' }, { id: 'asc' }],
      }),
      this.db.redirect.count({ where }),
    ]);
    return paginated(rows.map(administrative ? redirectAdmin : redirect), total, query);
  }
  async redirectDetail(id: string) {
    return redirectAdmin(exists(await this.db.redirect.findUnique({ where: { id } })));
  }
  private async validateRedirect(tx: Prisma.TransactionClient, value: RedirectDto, id?: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(6006001)`;
    return validateRedirectGraph(tx, value, id);
  }
  async createRedirect(dto: RedirectDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(
        async (tx) => {
          await this.validateRedirect(tx, dto);
          const row = await tx.redirect.create({
            data: {
              sourcePath: dto.sourcePath,
              targetPath: dto.targetPath,
              statusCode: dto.statusCode,
              isActive: dto.isActive,
            },
          });
          await audit(tx, actor.id, 'redirect.created', 'redirect', row.id);
          return redirectAdmin(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async updateRedirect(id: string, dto: RedirectPatchDto, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(
        async (tx) => {
          const current = exists(await tx.redirect.findUnique({ where: { id } }));
          await this.validateRedirect(
            tx,
            {
              sourcePath: dto.sourcePath ?? current.sourcePath,
              targetPath: dto.targetPath ?? current.targetPath,
              isActive: dto.isActive ?? current.isActive,
            },
            id,
          );
          versionUpdated(
            (
              await tx.redirect.updateMany({
                where: { id, version: dto.version },
                data: {
                  sourcePath: dto.sourcePath,
                  targetPath: dto.targetPath,
                  statusCode: dto.statusCode,
                  isActive: dto.isActive,
                  version: { increment: 1 },
                },
              })
            ).count,
          );
          await audit(tx, actor.id, 'redirect.updated', 'redirect', id);
          return redirectAdmin(exists(await tx.redirect.findUnique({ where: { id } })));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
  async removeRedirect(id: string, version: number, actor: Actor) {
    return databaseWrite(() =>
      this.db.$transaction(async (tx) => {
        exists(await tx.redirect.findUnique({ where: { id } }));
        versionUpdated((await tx.redirect.deleteMany({ where: { id, version } })).count);
        await audit(tx, actor.id, 'redirect.deleted', 'redirect', id);
        return { deleted: true };
      }),
    );
  }
}
