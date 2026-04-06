CREATE TABLE IF NOT EXISTS advertisements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT 'inline',
    size TEXT NOT NULL DEFAULT 'small',
    status TEXT NOT NULL DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    start_date INTEGER,
    end_date INTEGER,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Create index for faster ad lookups
CREATE INDEX IF NOT EXISTS idx_ads_position_status ON advertisements(position, status);
CREATE INDEX IF NOT EXISTS idx_ads_priority ON advertisements(priority DESC);
