import type { PaginatedResponse } from './domain';

export interface RelationshipAccepted {
  accepted: true;
  message: string;
}

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string;
  state?: string;
  practiceAreaId?: string;
  subject: string;
  message: string;
  privacyAccepted: true;
  newsletterConsent?: boolean;
  turnstileToken: string;
  idempotencyKey: string;
}

export interface NewsletterSubscription {
  email: string;
  name?: string;
  consent: true;
  turnstileToken: string;
}

export type ContactState = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'ARCHIVED';
export type NewsletterState = 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED';
export type ContactFileScanStatus = 'QUARANTINED' | 'LOCAL_VERIFIED' | 'VERIFIED' | 'REJECTED';

export interface AdminContactFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  scanStatus: ContactFileScanStatus;
}

export interface AdminContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  state: string | null;
  subject: string;
  message: string;
  practiceAreaId: string | null;
  status: ContactState;
  privacyVersion: string;
  consentedAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  attachments: AdminContactFile[];
}

export interface AdminSubscriber {
  id: string;
  email: string;
  name: string | null;
  status: NewsletterState;
  consentVersion: string;
  consentedAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ContactDownloadIssued {
  url: string;
  expiresAt: string;
}

export type AdminContactsResponse = PaginatedResponse<AdminContact>;
export type AdminSubscribersResponse = PaginatedResponse<AdminSubscriber>;
