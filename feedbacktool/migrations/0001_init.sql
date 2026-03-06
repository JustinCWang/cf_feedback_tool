-- Enable FK enforcement (per-connection; Wrangler applies this during migration execution)
PRAGMA foreign_keys = ON;

-- Themes: clustered rollups (Phase 3+)
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT,

  sentiment TEXT,
  urgency TEXT,

  volume_24h INTEGER DEFAULT 0,
  volume_7d INTEGER DEFAULT 0,

  first_seen_at TEXT,
  last_seen_at TEXT,

  updated_at TEXT NOT NULL
);

-- Digests: generated PM summaries (optional)
CREATE TABLE IF NOT EXISTS digests (
  id TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Feedback items: source of truth for raw feedback + AI annotations
CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,

  source TEXT NOT NULL,
  source_ref TEXT,
  url TEXT,
  author TEXT,
  account_tier TEXT,
  product_area TEXT,

  created_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  location_region TEXT,
  location_country TEXT,
  location_colo TEXT,

  text TEXT NOT NULL,
  text_hash TEXT,
  metadata_json TEXT,

  sentiment TEXT,
  urgency TEXT,

  theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
  embedding_id TEXT,

  processed_at TEXT
);

-- Indexes (read patterns: inbox filters + time windows + analysis queues)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
ON feedback_items(created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_source_created
ON feedback_items(source, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_theme_created
ON feedback_items(theme_id, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_product_created
ON feedback_items(product_area, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_ingested_at
ON feedback_items(ingested_at);

CREATE INDEX IF NOT EXISTS idx_feedback_text_hash
ON feedback_items(text_hash);

-- These are intended to accelerate "find unprocessed items" queries.
-- Partial indexes are materially more useful than indexing the nullable column itself.
CREATE INDEX IF NOT EXISTS idx_feedback_embedding_null
ON feedback_items(created_at)
WHERE embedding_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_sentiment_null
ON feedback_items(created_at)
WHERE sentiment IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_urgency_null
ON feedback_items(created_at)
WHERE urgency IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_processed_at_null
ON feedback_items(created_at)
WHERE processed_at IS NULL;

-- Uniqueness constraint for realistic dedupe on ingest (when source_ref is present)
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_source_ref
ON feedback_items(source, source_ref)
WHERE source_ref IS NOT NULL;
