CREATE TYPE "ContactScanStatus" AS ENUM ('QUARANTINED', 'LOCAL_VERIFIED', 'VERIFIED', 'REJECTED');

ALTER TABLE "contacts" ADD COLUMN "consent_ip_hash" TEXT,
  ADD COLUMN "idempotency_key" UUID,
  ADD COLUMN "request_hash" VARCHAR(64),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "contacts_idempotency_key_key" ON "contacts"("idempotency_key");
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirmation_sent_at" TIMESTAMPTZ(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "contact_files" (
  "id" UUID NOT NULL,
  "contact_id" UUID,
  "storage_key" VARCHAR(500) NOT NULL,
  "storage_driver" VARCHAR(10) NOT NULL,
  "filename" VARCHAR(200) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "scan_status" "ContactScanStatus" NOT NULL DEFAULT 'QUARANTINED',
  "expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contact_files_size_check" CHECK ("size" > 0 AND "size" <= 10485760),
  CONSTRAINT "contact_files_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "contact_files_storage_key_key" ON "contact_files"("storage_key");
CREATE INDEX "contact_files_contact_id_idx" ON "contact_files"("contact_id");
CREATE INDEX "contact_files_expires_at_idx" ON "contact_files"("expires_at");

CREATE TABLE "contact_download_tickets" (
  "id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "admin_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_download_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contact_download_tickets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "contact_files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "contact_download_tickets_token_hash_key" ON "contact_download_tickets"("token_hash");
CREATE INDEX "contact_download_tickets_expires_at_idx" ON "contact_download_tickets"("expires_at");

CREATE TABLE "mail_webhook_events" (
  "id" VARCHAR(160) NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "email_id" VARCHAR(160),
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mail_webhook_events_pkey" PRIMARY KEY ("id")
);
