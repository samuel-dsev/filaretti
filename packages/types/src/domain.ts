export type UserRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';
export type ArticleType = 'ARTICLE' | 'UPDATE' | 'GUIDE';
export type PublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
export interface TipTapMark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link';
  attrs?: { href: string };
}
export interface TipTapNode {
  type:
    | 'doc'
    | 'paragraph'
    | 'heading'
    | 'text'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'blockquote'
    | 'hardBreak'
    | 'horizontalRule'
    | 'codeBlock';
  attrs?: { level?: number; start?: number; language?: string };
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}
export interface TipTapDocument extends TipTapNode {
  type: 'doc';
  content: TipTapNode[];
}
export interface PageSection {
  key: string;
  heading?: string;
  body: TipTapDocument;
}
export interface PublicMedia {
  id: string;
  alt: string | null;
  mimeType: string;
  size: number;
  url: string;
}
export interface TaxonomySummary {
  id: string;
  slug: string;
  name: string;
}
export interface ProfessionalSummary {
  id: string;
  slug: string;
  name: string;
  title: string;
  photo: PublicMedia | null;
}
export interface PublicProfessional extends ProfessionalSummary {
  bio: TipTapDocument;
  education: string[];
  experience: string[];
  practiceAreas: TaxonomySummary[];
}
export interface PublicPracticeArea extends TaxonomySummary {
  summary: string;
  description: TipTapDocument;
  services: string[];
  professionals: ProfessionalSummary[];
}
export interface PublicArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: ArticleType;
  featured: boolean;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  author: ProfessionalSummary | null;
  cover: PublicMedia | null;
  categories: TaxonomySummary[];
  tags: TaxonomySummary[];
  practiceAreas: TaxonomySummary[];
}
export interface PublicArticle extends PublicArticleSummary {
  content: TipTapDocument;
  pdf: PublicMedia | null;
  seoTitle: string | null;
  seoDescription: string | null;
}
export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  seoTitle: string | null;
  seoDescription: string | null;
}
export interface PublicFaq {
  id: string;
  question: string;
  answer: TipTapDocument;
  practiceArea: TaxonomySummary | null;
}
export interface PublicSiteSettings {
  siteName: string;
  publicEmail: string | null;
  publicPhone: string | null;
  whatsappUrl: string | null;
  address: Record<string, string>;
  socialLinks: { label: string; url: string }[];
}
export interface PublicRedirect {
  sourcePath: string;
  targetPath: string;
  statusCode: number;
}

/** Future adapters implement these contracts; F2 exposes no upload or relationship flow. */
export interface MediaStoragePort {
  put(input: {
    key: string;
    bytes: Uint8Array;
    mimeType: string;
    visibility: 'PUBLIC' | 'PRIVATE';
  }): Promise<void>;
  remove(key: string): Promise<void>;
  signedPrivateDownload(key: string, expiresInSeconds: number): Promise<string>;
}
export interface ContactSubmissionPort {
  submit(input: {
    name: string;
    email: string;
    subject: string;
    message: string;
    phone?: string;
    state?: string;
    practiceAreaId?: string;
    privacyVersion: string;
    attachmentIds: string[];
    idempotencyKey: string;
  }): Promise<{ id: string }>;
}
export interface NewsletterPort {
  requestConfirmation(input: {
    email: string;
    consentVersion: string;
    idempotencyKey: string;
  }): Promise<void>;
  confirm(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
}
export interface TaskQueuePort {
  enqueue(input: {
    type: 'EMAIL' | 'PUBLICATION' | 'REVALIDATION' | 'RETENTION';
    idempotencyKey: string;
    payload: Record<string, string>;
    runAt: Date;
  }): Promise<{ id: string }>;
}
