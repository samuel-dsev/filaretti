-- PostgreSQL rules that cannot be represented by the Prisma schema.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK (email = lower(btrim(email)));
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_email_normalized" CHECK (email = lower(btrim(email)));
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_email_normalized" CHECK (email = lower(btrim(email)));
ALTER TABLE "articles" ADD CONSTRAINT "articles_publication_dates" CHECK (
  (status <> 'PUBLISHED' OR published_at IS NOT NULL) AND
  (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL)
);
ALTER TABLE "articles" ADD CONSTRAINT "articles_version_positive" CHECK (version > 0 AND reading_time_minutes > 0);
ALTER TABLE "articles" ADD CONSTRAINT "articles_content_object" CHECK (jsonb_typeof(content) = 'object');
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_structured_content" CHECK (
  jsonb_typeof(bio) = 'object' AND jsonb_typeof(education) = 'array' AND jsonb_typeof(experience) = 'array' AND version > 0
);
ALTER TABLE "practice_areas" ADD CONSTRAINT "areas_structured_content" CHECK (
  jsonb_typeof(description) = 'object' AND jsonb_typeof(services) = 'array' AND version > 0
);
ALTER TABLE "pages" ADD CONSTRAINT "pages_structure_publication" CHECK (
  jsonb_typeof(sections) = 'array' AND version > 0 AND (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_answer_object" CHECK (jsonb_typeof(answer) = 'object' AND version > 0);
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton" CHECK (id = 'site' AND version > 0);
ALTER TABLE "media" ADD CONSTRAINT "media_private_url" CHECK (visibility <> 'PRIVATE' OR public_url IS NULL);
ALTER TABLE "media" ADD CONSTRAINT "media_size_positive" CHECK (size > 0);
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "subscriber_state_evidence" CHECK (
  (status <> 'ACTIVE' OR confirmed_at IS NOT NULL) AND (status <> 'UNSUBSCRIBED' OR unsubscribed_at IS NOT NULL)
);
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_internal_paths" CHECK (
  left(source_path, 1) = '/' AND left(source_path, 2) <> '//' AND
  left(target_path, 1) = '/' AND left(target_path, 2) <> '//' AND
  position(chr(92) in source_path) = 0 AND position(chr(92) in target_path) = 0 AND
  source_path <> target_path AND status_code IN (301, 302, 307, 308) AND version > 0
);
ALTER TABLE "outbox_tasks" ADD CONSTRAINT "outbox_attempts_valid" CHECK (attempts >= 0 AND max_attempts > 0);
ALTER TABLE "login_rate_limits" ADD CONSTRAINT "login_rate_count_positive" CHECK (count >= 0);

-- Defense in depth: a contact attachment must stay private, and editorial assets
-- must stay public. Row locks prevent concurrent visibility changes escaping this rule.
CREATE FUNCTION "check_media_reference_visibility"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reference_id uuid;
DECLARE required_visibility "MediaVisibility";
DECLARE actual_visibility "MediaVisibility";
BEGIN
  required_visibility := CASE WHEN TG_TABLE_NAME = 'contact_attachments' THEN 'PRIVATE'::"MediaVisibility" ELSE 'PUBLIC'::"MediaVisibility" END;
  IF TG_TABLE_NAME = 'articles' THEN
    FOR reference_id IN SELECT unnest(ARRAY[NEW.cover_media_id, NEW.pdf_media_id]) LOOP
      IF reference_id IS NOT NULL THEN
        SELECT visibility INTO actual_visibility FROM media WHERE id = reference_id FOR SHARE;
        IF FOUND AND actual_visibility <> required_visibility THEN
          RAISE EXCEPTION 'MEDIA_VISIBILITY_MISMATCH' USING ERRCODE = '23514';
        END IF;
      END IF;
    END LOOP;
  ELSE
    IF TG_TABLE_NAME = 'professionals' THEN
      reference_id := NEW.photo_media_id;
    ELSE
      reference_id := NEW.media_id;
    END IF;
    IF reference_id IS NOT NULL THEN
      SELECT visibility INTO actual_visibility FROM media WHERE id = reference_id FOR SHARE;
      IF FOUND AND actual_visibility <> required_visibility THEN
        RAISE EXCEPTION 'MEDIA_VISIBILITY_MISMATCH' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "articles_media_visibility" BEFORE INSERT OR UPDATE OF cover_media_id, pdf_media_id ON articles FOR EACH ROW EXECUTE FUNCTION check_media_reference_visibility();
CREATE TRIGGER "professionals_media_visibility" BEFORE INSERT OR UPDATE OF photo_media_id ON professionals FOR EACH ROW EXECUTE FUNCTION check_media_reference_visibility();
CREATE TRIGGER "attachments_media_visibility" BEFORE INSERT OR UPDATE OF media_id ON contact_attachments FOR EACH ROW EXECUTE FUNCTION check_media_reference_visibility();

CREATE FUNCTION "check_media_visibility_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.visibility = 'PRIVATE' AND (
    EXISTS(SELECT 1 FROM articles WHERE cover_media_id = NEW.id OR pdf_media_id = NEW.id) OR
    EXISTS(SELECT 1 FROM professionals WHERE photo_media_id = NEW.id)
  ) THEN RAISE EXCEPTION 'MEDIA_VISIBILITY_MISMATCH' USING ERRCODE = '23514'; END IF;
  IF NEW.visibility = 'PUBLIC' AND EXISTS(SELECT 1 FROM contact_attachments WHERE media_id = NEW.id) THEN
    RAISE EXCEPTION 'MEDIA_VISIBILITY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "media_visibility_change" BEFORE UPDATE OF visibility ON media FOR EACH ROW WHEN (OLD.visibility IS DISTINCT FROM NEW.visibility) EXECUTE FUNCTION check_media_visibility_change();

-- Search vectors contain only eligible public content; API queries also enforce
-- publication dates and active flags. Portuguese stemming is provided by PostgreSQL.
CREATE FUNCTION "refresh_article_search"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := CASE WHEN NEW.status = 'PUBLISHED' THEN
    setweight(to_tsvector('portuguese', NEW.title), 'A') ||
    setweight(to_tsvector('portuguese', NEW.excerpt), 'B') ||
    setweight(jsonb_to_tsvector('portuguese', NEW.content, '["string"]'::jsonb), 'C')
    ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER "articles_search_refresh" BEFORE INSERT OR UPDATE OF title, excerpt, content, status ON articles FOR EACH ROW EXECUTE FUNCTION refresh_article_search();
CREATE INDEX "articles_public_search_gin" ON articles USING GIN(search_vector) WHERE status = 'PUBLISHED';

CREATE FUNCTION "refresh_professional_search"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := CASE WHEN NEW.is_active THEN
    setweight(to_tsvector('portuguese', NEW.name || ' ' || NEW.title), 'A') ||
    setweight(jsonb_to_tsvector('portuguese', NEW.bio, '["string"]'::jsonb), 'B')
    ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER "professionals_search_refresh" BEFORE INSERT OR UPDATE OF name, title, bio, is_active ON professionals FOR EACH ROW EXECUTE FUNCTION refresh_professional_search();
CREATE INDEX "professionals_active_search_gin" ON professionals USING GIN(search_vector) WHERE is_active = true;

CREATE FUNCTION "refresh_area_search"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := CASE WHEN NEW.is_active THEN
    setweight(to_tsvector('portuguese', NEW.name), 'A') ||
    setweight(to_tsvector('portuguese', NEW.summary), 'B') ||
    setweight(jsonb_to_tsvector('portuguese', NEW.description, '["string"]'::jsonb), 'C')
    ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER "areas_search_refresh" BEFORE INSERT OR UPDATE OF name, summary, description, is_active ON practice_areas FOR EACH ROW EXECUTE FUNCTION refresh_area_search();
CREATE INDEX "areas_active_search_gin" ON practice_areas USING GIN(search_vector) WHERE is_active = true;
