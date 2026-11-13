import type {
  PaginationMeta,
  PublicArticleSummary,
  PublicPage,
  PublicPracticeArea,
  PublicProfessional,
  PublicFaq,
  PublicSiteSettings,
} from '@filaretti/types';

export interface HomeViewProps {
  page: PublicPage;
  areas: PublicPracticeArea[];
  professionals: PublicProfessional[];
  articles: PublicArticleSummary[];
}

export interface OfficeViewProps {
  page: PublicPage;
  settings: PublicSiteSettings;
}

export interface AreaIndexViewProps {
  areas: PublicPracticeArea[];
  pagination: PaginationMeta;
}

export interface AreaDetailViewProps {
  area: PublicPracticeArea;
  articles: PublicArticleSummary[];
  faqs?: PublicFaq[];
  faqTotal?: number;
}

export interface ProfessionalIndexViewProps {
  professionals: PublicProfessional[];
  pagination: PaginationMeta;
}

export interface ProfessionalDetailViewProps {
  professional: PublicProfessional;
  articles: PublicArticleSummary[];
}
