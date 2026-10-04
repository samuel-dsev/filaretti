ALTER TABLE media ADD COLUMN storage_driver varchar(10) NOT NULL DEFAULT 'local';
ALTER TABLE media ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE media ADD CONSTRAINT media_storage_driver_check CHECK (storage_driver IN ('local', 'r2'));
ALTER TABLE media ADD CONSTRAINT media_version_check CHECK (version > 0);
CREATE INDEX media_visibility_created_at_idx ON media(visibility, created_at DESC);
