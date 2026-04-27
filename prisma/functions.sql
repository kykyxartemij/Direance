-- Run once against your Neon database after prisma db push.
-- Creates the check_rate_limit function used by rateLimiter.ts.
-- Re-running is safe (CREATE OR REPLACE).

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
