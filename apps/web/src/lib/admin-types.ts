import type {
  ArticleType,
  PageSection,
  PublicMedia,
  PublicationStatus,
  TipTapDocument,
} from '@filaretti/types';

export const emptyDocument = (): TipTapDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

/** Client form projection. Every mutation builds the endpoint-specific allowlist below. */
export interface AdminEntity {
  id?: string;
  version: number;
  name: string;
  title: string;
  slug: string;
  question: string;
  excerpt: string;
  summary: string;
  content: TipTapDocument;
  description: TipTapDocument;
  bio: TipTapDocument;
  answer: TipTapDocument;
  type: ArticleType;
  status: PublicationStatus;
  authorId: string;
  coverMediaId: string | null;
  pdfMediaId: string | null;
  photoMediaId: string | null;
  featured: boolean;
  categoryIds: string[];
  tagIds: string[];
  practiceAreaIds: string[];
  practiceAreaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  services: string[];
  education: string[];
  experience: string[];
  sections: PageSection[];
  isActive: boolean;
  sortOrder: number;
  sourcePath: string;
  targetPath: string;
  statusCode: number;
  scheduledAt: string | null;
  updatedAt?: string;
}

export function blankEntity(): AdminEntity {
  return {
    version: 1,
    name: '',
    title: '',
    slug: '',
    question: '',
    excerpt: '',
    summary: '',
    content: emptyDocument(),
    description: emptyDocument(),
    bio: emptyDocument(),
    answer: emptyDocument(),
    type: 'ARTICLE',
    status: 'DRAFT',
    authorId: '',
    coverMediaId: null,
    pdfMediaId: null,
    photoMediaId: null,
    featured: false,
    categoryIds: [],
    tagIds: [],
    practiceAreaIds: [],
    practiceAreaId: null,
    seoTitle: null,
    seoDescription: null,
    services: [],
    education: [],
    experience: [],
    sections: [],
    isActive: true,
    sortOrder: 0,
    sourcePath: '',
    targetPath: '',
    statusCode: 301,
    scheduledAt: null,
  };
}

export interface AdminMedia extends Omit<PublicMedia, 'url'> {
  version: number;
  references: number;
  ownerId: string;
  url?: string | null;
  originalName?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  source: string | null;
  license: string | null;
  createdAt: string;
  updatedAt: string;
}

export const resources = {
  artigos: { label: 'Artigos', singular: 'artigo', endpoint: 'articles' },
  categorias: { label: 'Categorias', singular: 'categoria', endpoint: 'taxonomies/categories' },
  tags: { label: 'Tags', singular: 'tag', endpoint: 'taxonomies/tags' },
  areas: { label: 'Áreas de atuação', singular: 'área', endpoint: 'practice-areas' },
  profissionais: { label: 'Profissionais', singular: 'profissional', endpoint: 'professionals' },
  paginas: { label: 'Páginas institucionais', singular: 'página', endpoint: 'pages' },
  faq: { label: 'Perguntas frequentes', singular: 'pergunta', endpoint: 'faqs' },
  redirects: { label: 'Redirecionamentos', singular: 'redirecionamento', endpoint: 'redirects' },
} as const;
export type ResourceKey = keyof typeof resources;

export const statusLabels: Record<PublicationStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
};
export const typeLabels: Record<ArticleType, string> = {
  ARTICLE: 'Artigo',
  UPDATE: 'Atualização',
  GUIDE: 'Guia',
};

export function entityPayload(kind: ResourceKey, entity: AdminEntity) {
  const { name, title, slug, isActive, sortOrder, seoTitle, seoDescription } = entity;
  switch (kind) {
    case 'artigos':
      return {
        title,
        slug,
        excerpt: entity.excerpt,
        content: entity.content,
        type: entity.type,
        authorId: entity.authorId,
        coverMediaId: entity.coverMediaId,
        pdfMediaId: entity.type === 'GUIDE' ? entity.pdfMediaId : null,
        featured: entity.featured,
        categoryIds: entity.categoryIds,
        tagIds: entity.tagIds,
        practiceAreaIds: entity.practiceAreaIds,
        seoTitle,
        seoDescription,
      };
    case 'categorias':
    case 'tags':
      return { name, slug, isActive };
    case 'areas':
      return {
        name,
        slug,
        isActive,
        sortOrder,
        summary: entity.summary,
        description: entity.description,
        services: entity.services,
      };
    case 'profissionais':
      return {
        name,
        slug,
        title,
        isActive,
        sortOrder,
        bio: entity.bio,
        education: entity.education,
        experience: entity.experience,
        photoMediaId: entity.photoMediaId,
        practiceAreaIds: entity.practiceAreaIds,
      };
    case 'paginas':
      return { title, slug, sections: entity.sections, seoTitle, seoDescription };
    case 'faq':
      return {
        question: entity.question,
        answer: entity.answer,
        practiceAreaId: entity.practiceAreaId,
        isActive,
        sortOrder,
      };
    case 'redirects':
      return {
        sourcePath: entity.sourcePath,
        targetPath: entity.targetPath,
        statusCode: entity.statusCode,
        isActive,
      };
  }
}
