# Plan & Progress

## Phase 1: Foundation + Manual Newsletter ✅

- [x] Project scaffolding (Node.js + TypeScript, ESM)
- [x] SQLite database + schema
- [x] Models (Article, Subscriber, NewsletterIssue)
- [x] CLI tools (add-article, add-subscriber, select-article, send-newsletter)
- [x] Email sending via Resend
- [x] React Email template

## Phase 2: Content Pipeline ✅

- [x] Email ingestion via IMAP polling (Gmail: ludvig.ai.newsletter@gmail.com)
- [x] Newsletter parsers (The Batch, AlphaSignal, Import AI, The Rundown)
- [x] RSS feed polling (Anthropic, OpenAI, DeepMind blogs)
- [x] Claude API article summarization
- [x] Claude API article categorization
- [x] Article deduplication (by URL and normalized title)

## Phase 3: Deployment & Subscriber Growth ← CURRENT

- [x] Express API server
  - [x] Health check endpoint (GET /health)
  - [x] Status page (GET /)
  - [x] Pipeline trigger endpoints (POST /api/pipeline/poll-rss, poll-emails, summarize, categorize, send-newsletter, run-all)
  - [x] Article management endpoints (GET/POST /api/articles)
  - [x] Bearer token auth middleware (API_SECRET)
- [x] Dockerfile for Railway (node:20-slim + native build tools)
- [x] Integration tests (15 tests: health, auth, CRUD, RSS polling, newsletter)
- [x] Newsletter feed design (ranking, composition, trending)
  - [x] Unified enricher (summary + categories + score + actionable in one LLM call)
  - [x] HN trending detection (cross-reference articles with HN top stories)
  - [x] Rule-based newsletter composer (top story, try this, ranked list)
  - [x] Flat ranked list template with inline tags (Top Story, Try This, Trending, category pills)
  - [x] Small batch LLM call for editorial top story pick + intro
  - [x] Pipeline API: POST /enrich, /compose, /send-composed
  - [x] Updated daily-digest CLI with enrichment + composition
- [ ] Railway configuration (manual steps)
  - [ ] Add persistent volume at /data, set DATABASE_PATH=/data/ai-news.db
  - [ ] Set environment variables: RESEND_API_KEY, CLAUDE_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, BASE_URL, API_SECRET
  - [ ] Verify deployment health check passes
- [ ] Subscribe endpoint (POST /subscribe)
- [ ] Unsubscribe endpoint (GET /unsubscribe/:token)
- [ ] Confirm endpoint (GET /confirm/:token)
- [ ] Public landing page
  - [ ] Simple subscribe form
  - [ ] Newsletter archive / past issues
- [ ] Double opt-in flow
  - [ ] Confirmation email on subscribe
  - [ ] Status: pending → active on confirm

## Phase 4: Automation & Admin

- [ ] Scheduled cron jobs on Railway
  - [ ] Daily: poll emails + RSS + enrich
  - [ ] Daily: detect trending
  - [ ] Weekly: compose + send newsletter (or manual trigger)
- [ ] Admin dashboard (simple web UI)
  - [ ] View ingested articles with scores and tags
  - [ ] Preview composed newsletter before sending
  - [ ] Override top story / try this picks
  - [ ] Send newsletter
- [ ] Draft preview workflow
- [ ] Content queue management

## Phase 5: PWA + Polish

- [ ] Personal reading archive
- [ ] Mobile-friendly PWA
- [ ] Improved admin UI
- [ ] Public archive for SEO
- [ ] Basic analytics (opens, clicks)

## Success Metrics

**Phase 1-2 (MVP):**
- Ship first newsletter to 2 subscribers
- Establish consistent weekly cadence

**Phase 3-4 (Growth):**
- 100 subscribers
- 40%+ open rate
- Positive feedback/replies

**Phase 5+ (Established):**
- 1000+ subscribers
- Recognized in AI community
- Speaking/job opportunities from visibility
