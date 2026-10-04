import type { PublicArticle } from './domain';

export interface AdminMedia {
  id: string;
  ownerId: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  url: string | null;
  mimeType: string;
  size: number;
  alt: string | null;
  source: string | null;
  license: string | null;
  version: number;
  references: number;
  createdAt: string;
  updatedAt: string;
}
export interface PreviewIssued {
  token: string;
  expiresAt: string;
}
export interface ArticlePreview {
  article: PublicArticle;
  expiresAt: string;
}
