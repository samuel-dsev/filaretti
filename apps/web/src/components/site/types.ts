import type { ReactNode } from 'react';

export interface SiteBrand {
  name: string;
  href: string;
  monogram?: string;
  caption?: string;
}

export interface SiteNavigationLink {
  label: string;
  href: string;
  description?: string;
}

export interface SiteNavigationItem {
  id: string;
  label: string;
  href?: string;
  description?: string;
  children?: SiteNavigationLink[];
}

export interface SiteHeaderProps {
  brand: SiteBrand;
  navigation: SiteNavigationItem[];
  searchLabel?: string;
}

export interface SiteFooterProps {
  brand: SiteBrand;
  description: string;
  groups: { title: string; links: SiteNavigationLink[] }[];
  note?: string;
  copyright: string;
}

export interface PublicLayoutProps {
  header: SiteHeaderProps;
  footer: SiteFooterProps;
  children: ReactNode;
}

export interface HeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: { label: string; href: string; secondary?: boolean }[];
  visual?: ReactNode;
}

export interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export interface EditorialCardProps {
  category: string;
  title: string;
  description: string;
  href?: string;
  dateLabel?: string;
  readingTimeLabel?: string;
  image?: { src: string; alt: string };
  label?: string;
}

export interface PracticeAreaCardProps {
  number?: string;
  title: string;
  description: string;
  href?: string;
}

export interface ProfessionalCardProps {
  name: string;
  role: string;
  description?: string;
  href?: string;
  image?: { src: string; alt: string };
  areas?: string[];
}
