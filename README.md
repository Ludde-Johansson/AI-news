# AI News Newsletter

A public AI newsletter that establishes thought leadership in the AI space.

**Long-term goal:** Create a recognized voice in AI news curation that helps land AI jobs and contribute to public AI discourse.

## What We're Building

A daily curated AI news digest:

- **Aggregates** news from newsletters (The Batch, AlphaSignal, etc.) and RSS feeds (Anthropic, OpenAI, DeepMind, Vercel, Cursor, etc.)
- **Enriches** each article with Claude API — summary, categories, relevance score (1-10), actionable flag
- **Detects trending** by cross-referencing with Hacker News top stories
- **Composes** newsletter automatically — picks Top Story, Try This, and ranks the rest
- **Delivers** via email to subscribers as a flat ranked list with inline tags

**Current scope:** MVP with 2 subscribers (owner + friend)

## Tech Stack

| Component         | Choice                  | Why                            |
| ----------------- | ----------------------- | ------------------------------ |
| Backend           | Node.js + TypeScript    | Owner preference               |
| Database          | SQLite (better-sqlite3) | Simple, no server needed       |
| Email sending     | Resend                  | Modern DX, good deliverability |
| Email ingestion   | Gmail IMAP polling      | Direct inbox access, no webhook setup |
| LLM               | Claude API (Sonnet)     | Enrichment (summary + score + categories) |
| Trending          | Hacker News API         | Early trend detection          |
| Hosting           | Railway.app             | Easy deploy, cron support      |

## Current Status

**Phase 3: Deployment & Subscriber Growth** — IN PROGRESS

- [x] Phase 1: Foundation (schema, models, CLI, Resend integration)
- [x] Phase 2: Content pipeline (email ingestion, RSS, summarization, categorization, dedup)
- [x] Phase 3 partial: API server, Dockerfile, integration tests
- [x] Phase 3 partial: Newsletter feed design (enricher, composer, trending, template)
- [ ] Phase 3 remaining: Railway deploy, subscribe/unsubscribe endpoints, landing page

See [PLAN.md](PLAN.md) for full roadmap.

## Quick Start

```bash
# Run the full daily pipeline (poll → enrich → trend → compose)
npx tsx src/cli/daily-digest.ts

# Dry run (no DB writes)
npx tsx src/cli/daily-digest.ts --dry-run --skip-emails

# Enrich articles only (summary + categories + score + actionable)
npx tsx src/cli/enrich-articles.ts

# Add a manual article
npx tsx src/cli/add-article.ts --title "AI News" --source "manual" --content "..."

# Add a subscriber
npx tsx src/cli/add-subscriber.ts your@email.com

# Send composed newsletter (top story + try this + ranked list)
npx tsx src/cli/send-newsletter.ts --title "This Week in AI" --dry-run
```

## API Endpoints

All pipeline endpoints require `Authorization: Bearer <API_SECRET>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/pipeline/poll-rss` | Fetch RSS feeds |
| POST | `/api/pipeline/poll-emails` | Fetch Gmail newsletters |
| POST | `/api/pipeline/enrich` | Enrich articles (summary + score + categories + actionable) |
| POST | `/api/pipeline/compose` | Compose newsletter plan (top story, try this, ranked list) |
| POST | `/api/pipeline/send-composed` | Send composed newsletter to subscribers |
| POST | `/api/pipeline/run-all` | Full pipeline: poll → enrich → detect trending |
| GET | `/api/articles` | List articles (optional `?status=pending`) |

## Documentation

- [docs/vision.md](docs/vision.md) - Vision, strategy, and content sources
- [docs/architecture.md](docs/architecture.md) - Detailed technical design + feed design decisions
- [PLAN.md](PLAN.md) - Roadmap and progress tracking
- [CLAUDE.md](CLAUDE.md) - AI agent instructions
