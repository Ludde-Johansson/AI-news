# AI News Newsletter

## Vision

Build a **public AI newsletter** that establishes thought leadership in the AI space.

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

**Phase 1: Foundation + Manual Newsletter**

- [x] Project scaffolding
- [x] Dependencies installed
- [ ] Database schema
- [ ] Models (Article, Subscriber, NewsletterIssue)
- [ ] Resend integration
- [ ] CLI scripts
- [ ] First test newsletter

## Agent Rules

### Command Execution (CRITICAL)

**Run every command separately. NEVER chain with && or ;**

```bash
# WRONG
git add . && git commit -m "msg"

# CORRECT
git add .
git commit -m "msg"
```

This is required so permission patterns can match correctly.

### Pre-approved Commands

- npm install/run/test
- git status/add/commit/push/pull/log/diff
- npx tsc/eslint/prettier
- node, tsx, mkdir, ls

## Key Files

- [docs/architecture.md](docs/architecture.md) - Detailed technical design
- [.claude/settings.json](.claude/settings.json) - Permission rules
- `src/` - Application code
