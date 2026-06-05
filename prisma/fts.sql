-- Run once against your Neon database after prisma db push.
-- Enables full-text search + trigram similarity on ExportSetting and FieldMapping.
-- Re-running is safe — all statements use IF NOT EXISTS / CREATE OR REPLACE.

-- ==== Extension ====

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==== ExportSetting ====

ALTER TABLE "ExportSetting"
  ADD COLUMN IF NOT EXISTS search_vector tsvector NOT NULL DEFAULT ''::tsvector;

CREATE INDEX IF NOT EXISTS "ExportSetting_search_vector_idx"
  ON "ExportSetting" USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS "ExportSetting_name_trgm_idx"
  ON "ExportSetting" USING GIN (name gin_trgm_ops);

-- ==== FieldMapping ====

ALTER TABLE "FieldMapping"
  ADD COLUMN IF NOT EXISTS search_vector tsvector NOT NULL DEFAULT ''::tsvector;

CREATE INDEX IF NOT EXISTS "FieldMapping_search_vector_idx"
  ON "FieldMapping" USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS "FieldMapping_name_trgm_idx"
  ON "FieldMapping" USING GIN (name gin_trgm_ops);

-- ==== Trigger function (shared) ====

CREATE OR REPLACE FUNCTION update_name_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$;

-- ==== Triggers ====

DROP TRIGGER IF EXISTS export_setting_fts_update ON "ExportSetting";
CREATE TRIGGER export_setting_fts_update
  BEFORE INSERT OR UPDATE OF name ON "ExportSetting"
  FOR EACH ROW EXECUTE FUNCTION update_name_search_vector();

DROP TRIGGER IF EXISTS field_mapping_fts_update ON "FieldMapping";
CREATE TRIGGER field_mapping_fts_update
  BEFORE INSERT OR UPDATE OF name ON "FieldMapping"
  FOR EACH ROW EXECUTE FUNCTION update_name_search_vector();

-- ==== Connection ====

ALTER TABLE "Connection"
  ADD COLUMN IF NOT EXISTS search_vector tsvector NOT NULL DEFAULT ''::tsvector;

CREATE INDEX IF NOT EXISTS "Connection_search_vector_idx"
  ON "Connection" USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS "Connection_name_trgm_idx"
  ON "Connection" USING GIN (name gin_trgm_ops);

DROP TRIGGER IF EXISTS connection_fts_update ON "Connection";
CREATE TRIGGER connection_fts_update
  BEFORE INSERT OR UPDATE OF name ON "Connection"
  FOR EACH ROW EXECUTE FUNCTION update_name_search_vector();

-- ==== User ====

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS search_vector tsvector NOT NULL DEFAULT ''::tsvector;

CREATE INDEX IF NOT EXISTS "User_search_vector_idx"
  ON "User" USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN (name gin_trgm_ops);

DROP TRIGGER IF EXISTS user_fts_update ON "User";
CREATE TRIGGER user_fts_update
  BEFORE INSERT OR UPDATE OF name ON "User"
  FOR EACH ROW EXECUTE FUNCTION update_name_search_vector();

-- ==== Backfill existing rows ====

UPDATE "ExportSetting"
  SET search_vector = to_tsvector('english', COALESCE(name, ''))
  WHERE search_vector = ''::tsvector;

UPDATE "FieldMapping"
  SET search_vector = to_tsvector('english', COALESCE(name, ''))
  WHERE search_vector = ''::tsvector;

UPDATE "User"
  SET search_vector = to_tsvector('english', COALESCE(name, ''))
  WHERE search_vector = ''::tsvector;

UPDATE "Connection"
  SET search_vector = to_tsvector('english', COALESCE(name, ''))
  WHERE search_vector = ''::tsvector;
