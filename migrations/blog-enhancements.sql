-- Blog Enhancement Migration
-- Adds SEO, scheduling, and advanced blog features to the news table

-- Add SEO metadata fields
ALTER TABLE news ADD COLUMN meta_title TEXT;
ALTER TABLE news ADD COLUMN meta_description TEXT;
ALTER TABLE news ADD COLUMN og_image TEXT;
ALTER TABLE news ADD COLUMN canonical_url TEXT;

-- Add scheduling and timing fields
ALTER TABLE news ADD COLUMN scheduled_at INTEGER; -- timestamp for scheduled publishing
ALTER TABLE news ADD COLUMN reading_time INTEGER DEFAULT 0; -- in minutes
ALTER TABLE news ADD COLUMN last_updated_at INTEGER; -- timestamp for content updates

-- Add media and content fields
ALTER TABLE news ADD COLUMN featured_image_alt TEXT;
ALTER TABLE news ADD COLUMN featured_image_caption TEXT;
ALTER TABLE news ADD COLUMN gallery_images TEXT; -- JSON array of image URLs
ALTER TABLE news ADD COLUMN table_of_contents TEXT; -- JSON array of headings

-- Add engagement and display fields
ALTER TABLE news ADD COLUMN allow_comments INTEGER DEFAULT 1; -- boolean
ALTER TABLE news ADD COLUMN is_featured_in_category INTEGER DEFAULT 0; -- boolean
ALTER TABLE news ADD COLUMN pin_to_top INTEGER DEFAULT 0; -- boolean for sticky posts
ALTER TABLE news ADD COLUMN view_count_unique INTEGER DEFAULT 0; -- unique views

-- Add author enhancements
ALTER TABLE news ADD COLUMN co_authors TEXT; -- JSON array of author IDs

-- Add custom fields for flexibility
ALTER TABLE news ADD COLUMN custom_fields TEXT; -- JSON for extensibility

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_news_scheduled_at ON news(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
