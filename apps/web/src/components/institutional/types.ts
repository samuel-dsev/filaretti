import type {
  PaginationMeta,
  PublicArticleSummary,
  PublicPage,
  PublicPracticeArea,
  PublicProfessional,
  PublicSiteSettings,
} from '@filaretti/types';

export interface HomeViewProps {
  settings: PublicSiteSettings;
  page: PublicPage;
  office: PublicPage | null;
  areas: PublicPracticeArea[];
  professionals: PublicProfessional[];
  articles: PublicArticleSummary[];
  guides: PublicArticleSummary[];
  featuredArticles: PublicArticleSummary[];
}

export interface OfficeViewProps {
  page: PublicPage;
  settings: PublicSiteSettings;
  professionals: PublicProfessional[];
}

export interface AreaIndexViewProps {
  areas: PublicPracticeArea[];
  pagination: PaginationMeta;
}

export interface AreaDetailViewProps {
  area: PublicPracticeArea;
  articles: PublicArticleSummary[];
}

export interface ProfessionalIndexViewProps {
  professionals: PublicProfessional[];
  pagination: PaginationMeta;
}

export interface ProfessionalDetailViewProps {
  professional: PublicProfessional;
  articles: PublicArticleSummary[];
}
