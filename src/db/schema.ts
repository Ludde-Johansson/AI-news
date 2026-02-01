import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  // Articles table - stores ingested news articles
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('email', 'rss', 'manual')),
      original_url TEXT,
      title TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      summary TEXT,
      categories TEXT NOT NULL DEFAULT '[]',
      curation_status TEXT NOT NULL DEFAULT 'pending' CHECK (curation_status IN ('pending', 'selected', 'rejected', 'published')),
      published_at TEXT,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Subscribers table - stores newsletter subscribers
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
      unsubscribe_token TEXT NOT NULL UNIQUE,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    )
  `);

  // Newsletter issues table - stores sent newsletters
  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_issues (
      id TEXT PRIMARY KEY,
      issue_number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      article_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
      scheduled_for TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_curation_status ON articles(curation_status);
    CREATE INDEX IF NOT EXISTS idx_articles_ingested_at ON articles(ingested_at);
    CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
    CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
    CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status ON newsletter_issues(status);
  `);
}
