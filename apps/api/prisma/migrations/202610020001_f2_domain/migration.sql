-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'AUTHOR');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('ARTICLE', 'UPDATE', 'GUIDE');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "NewsletterTokenPurpose" AS ENUM ('CONFIRM', 'UNSUBSCRIBE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_changed_at" TIMESTAMPTZ(3),
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_rate_limits" (
    "key" VARCHAR(128) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3),

    CONSTRAINT "login_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "bio" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "experience" JSONB NOT NULL,
    "photo_media_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_areas" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "description" JSONB NOT NULL,
    "services" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "practice_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_practice_areas" (
    "professional_id" UUID NOT NULL,
    "practice_area_id" UUID NOT NULL,

    CONSTRAINT "professional_practice_areas_pkey" PRIMARY KEY ("professional_id","practice_area_id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "excerpt" VARCHAR(500) NOT NULL,
    "content" JSONB NOT NULL,
    "type" "ArticleType" NOT NULL DEFAULT 'ARTICLE',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cover_media_id" UUID,
    "pdf_media_id" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "reading_time_minutes" INTEGER NOT NULL DEFAULT 1,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(300),
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(3),
    "scheduled_at" TIMESTAMPTZ(3),
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_categories" (
    "article_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("article_id","category_id")
);

-- CreateTable
CREATE TABLE "article_tags" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "article_practice_areas" (
    "article_id" UUID NOT NULL,
    "practice_area_id" UUID NOT NULL,

    CONSTRAINT "article_practice_areas_pkey" PRIMARY KEY ("article_id","practice_area_id")
);

-- CreateTable
CREATE TABLE "preview_tokens" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "sections" JSONB NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(300),
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "answer" JSONB NOT NULL,
    "practice_area_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" VARCHAR(40) NOT NULL DEFAULT 'site',
    "site_name" VARCHAR(160) NOT NULL,
    "public_email" VARCHAR(254),
    "public_phone" VARCHAR(40),
    "whatsapp_url" VARCHAR(500),
    "address" JSONB NOT NULL,
    "social_links" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "storage_key" VARCHAR(500) NOT NULL,
    "public_url" VARCHAR(1000),
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" VARCHAR(300),
    "source" VARCHAR(500),
    "license" VARCHAR(300),
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40),
    "state" VARCHAR(2),
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "practice_area_id" UUID,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "privacy_version" VARCHAR(80) NOT NULL,
    "consented_at" TIMESTAMPTZ(3) NOT NULL,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_attachments" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(160),
    "status" "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "consent_version" VARCHAR(80) NOT NULL,
    "consented_at" TIMESTAMPTZ(3) NOT NULL,
    "consent_ip_hash" TEXT,
    "confirmed_at" TIMESTAMPTZ(3),
    "unsubscribed_at" TIMESTAMPTZ(3),
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_tokens" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "purpose" "NewsletterTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "source_path" VARCHAR(500) NOT NULL,
    "target_path" VARCHAR(500) NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_tasks" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "locked_by" VARCHAR(160),
    "completed_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100),
    "resource_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_revoked_at_idx" ON "refresh_tokens"("session_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_used_at_idx" ON "password_reset_tokens"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "login_rate_limits_window_start_idx" ON "login_rate_limits"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_slug_key" ON "professionals"("slug");

-- CreateIndex
CREATE INDEX "professionals_is_active_sort_order_idx" ON "professionals"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "professionals_photo_media_id_idx" ON "professionals"("photo_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "practice_areas_slug_key" ON "practice_areas"("slug");

-- CreateIndex
CREATE INDEX "practice_areas_is_active_sort_order_idx" ON "practice_areas"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "professional_practice_areas_practice_area_id_idx" ON "professional_practice_areas"("practice_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_published_at_idx" ON "articles"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "articles_status_featured_published_at_idx" ON "articles"("status", "featured", "published_at" DESC);

-- CreateIndex
CREATE INDEX "articles_type_status_published_at_idx" ON "articles"("type", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "articles_author_id_status_idx" ON "articles"("author_id", "status");

-- CreateIndex
CREATE INDEX "articles_created_by_id_status_idx" ON "articles"("created_by_id", "status");

-- CreateIndex
CREATE INDEX "articles_updated_by_id_idx" ON "articles"("updated_by_id");

-- CreateIndex
CREATE INDEX "articles_cover_media_id_idx" ON "articles"("cover_media_id");

-- CreateIndex
CREATE INDEX "articles_pdf_media_id_idx" ON "articles"("pdf_media_id");

-- CreateIndex
CREATE INDEX "articles_status_scheduled_at_idx" ON "articles"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_name_idx" ON "categories"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_is_active_name_idx" ON "tags"("is_active", "name");

-- CreateIndex
CREATE INDEX "article_categories_category_id_article_id_idx" ON "article_categories"("category_id", "article_id");

-- CreateIndex
CREATE INDEX "article_tags_tag_id_article_id_idx" ON "article_tags"("tag_id", "article_id");

-- CreateIndex
CREATE INDEX "article_practice_areas_practice_area_id_article_id_idx" ON "article_practice_areas"("practice_area_id", "article_id");

-- CreateIndex
CREATE UNIQUE INDEX "preview_tokens_token_hash_key" ON "preview_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "preview_tokens_article_id_revoked_at_idx" ON "preview_tokens"("article_id", "revoked_at");

-- CreateIndex
CREATE INDEX "preview_tokens_expires_at_idx" ON "preview_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_status_published_at_idx" ON "pages"("status", "published_at");

-- CreateIndex
CREATE INDEX "faqs_is_active_sort_order_idx" ON "faqs"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "faqs_practice_area_id_is_active_idx" ON "faqs"("practice_area_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "media_storage_key_key" ON "media"("storage_key");

-- CreateIndex
CREATE INDEX "media_owner_id_visibility_idx" ON "media"("owner_id", "visibility");

-- CreateIndex
CREATE INDEX "contacts_status_created_at_idx" ON "contacts"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contacts_practice_area_id_idx" ON "contacts"("practice_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_attachments_media_id_key" ON "contact_attachments"("media_id");

-- CreateIndex
CREATE INDEX "contact_attachments_contact_id_idx" ON "contact_attachments"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_created_at_idx" ON "newsletter_subscribers"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_tokens_token_hash_key" ON "newsletter_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "newsletter_tokens_subscriber_id_purpose_idx" ON "newsletter_tokens"("subscriber_id", "purpose");

-- CreateIndex
CREATE INDEX "newsletter_tokens_expires_at_idx" ON "newsletter_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_source_path_key" ON "redirects"("source_path");

-- CreateIndex
CREATE INDEX "redirects_is_active_idx" ON "redirects"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_tasks_idempotency_key_key" ON "outbox_tasks"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_tasks_status_available_at_idx" ON "outbox_tasks"("status", "available_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_created_at_idx" ON "audit_events"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_photo_media_id_fkey" FOREIGN KEY ("photo_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_practice_areas" ADD CONSTRAINT "professional_practice_areas_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_practice_areas" ADD CONSTRAINT "professional_practice_areas_practice_area_id_fkey" FOREIGN KEY ("practice_area_id") REFERENCES "practice_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_pdf_media_id_fkey" FOREIGN KEY ("pdf_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_practice_areas" ADD CONSTRAINT "article_practice_areas_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_practice_areas" ADD CONSTRAINT "article_practice_areas_practice_area_id_fkey" FOREIGN KEY ("practice_area_id") REFERENCES "practice_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_tokens" ADD CONSTRAINT "preview_tokens_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_tokens" ADD CONSTRAINT "preview_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_practice_area_id_fkey" FOREIGN KEY ("practice_area_id") REFERENCES "practice_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_practice_area_id_fkey" FOREIGN KEY ("practice_area_id") REFERENCES "practice_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attachments" ADD CONSTRAINT "contact_attachments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attachments" ADD CONSTRAINT "contact_attachments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_tokens" ADD CONSTRAINT "newsletter_tokens_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
