# AI News Newsletter

A public AI newsletter that establishes thought leadership in the AI space.

**Long-term goal:** Create a recognized voice in AI news curation that helps land AI jobs and contribute to public AI discourse.

## What We're Building

A daily curated AI news digest:

- **Aggregates** news from newsletters (The Batch, AlphaSignal, etc.) and RSS feeds
- **Summarizes** using Claude API
- **Curates** with human-in-the-loop selection
- **Delivers** via email to subscribers
- **Secondary:** PWA for personal reading

**Current scope:** MVP with 2 subscribers (owner + friend)

## Tech Stack

| Component       | Choice                  | Why                       |
| --------------- | ----------------------- | ------------------------- |
| Backend         | Node.js + TypeScript    | Owner preference          |
| Database        | SQLite (better-sqlite3) | Simple, no server needed  |
| Email sending   | Resend                  | Modern DX, React Email    |
| Email ingestion | Mailgun                 | Webhooks for newsletters  |
| LLM             | Claude API              | Summarization             |
| Hosting         | Railway.app             | Easy deploy, cron support |

## Current Status

**Phase 1: Foundation + Manual Newsletter** - COMPLETE

- [x] Project scaffolding
- [x] Dependencies installed
- [x] Database schema (`src/db/schema.ts`)
- [x] Models (Article, Subscriber, NewsletterIssue)
- [x] Resend integration (`src/services/newsletter/sender.ts`)
- [x] CLI scripts (`src/cli/`)
- [x] First test newsletter (requires RESEND_API_KEY)

## Quick Start

```bash
# Add a test article
npx tsx src/cli/add-article.ts --title "AI News" --source "Example" --content "..."

# Add a subscriber
npx tsx src/cli/add-subscriber.ts your@email.com

# Select articles for the newsletter
npx tsx src/cli/select-article.ts <article-id> selected

# Preview newsletter (dry run)
npx tsx src/cli/send-newsletter.ts --title "This Week in AI" --dry-run

# Send newsletter (requires RESEND_API_KEY)
RESEND_API_KEY=re_xxx npx tsx src/cli/send-newsletter.ts --title "This Week in AI"
```

## Documentation

- [docs/vision.md](docs/vision.md) - Vision, strategy, and roadmap
- [docs/architecture.md](docs/architecture.md) - Detailed technical design
- [CLAUDE.md](CLAUDE.md) - AI agent instructions
