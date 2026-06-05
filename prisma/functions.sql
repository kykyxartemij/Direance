-- Run once against your Neon database after prisma db push.
-- Re-running is safe (CREATE OR REPLACE / IF NOT EXISTS).

-- ==== set_updated_at trigger ====
-- Fires BEFORE UPDATE on every table that has an "updatedAt" column.
-- Auto-discovers tables via information_schema — re-run after prisma db push to pick up new tables.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updatedAt'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl || '_updated_at',
      tbl
    );
  END LOOP;
END;
$$;

-- ==== check_rate_limit ====
-- Creates the check_rate_limit function used by rateLimiter.ts.

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_max            INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO "RateLimit" (key, count, window_start)
  VALUES (p_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - "RateLimit".window_start)) > p_window_seconds
      THEN 1
      ELSE "RateLimit".count + 1
    END,
    window_start = CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - "RateLimit".window_start)) > p_window_seconds
      THEN NOW()
      ELSE "RateLimit".window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;
