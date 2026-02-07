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

- [ ] Deploy to Railway
  - [ ] Dockerfile / Railway config
  - [ ] Environment variables (RESEND_API_KEY, ANTHROPIC_API_KEY, GMAIL_APP_PASSWORD)
  - [ ] Persistent SQLite volume
  - [ ] Cron jobs for polling (email + RSS)
- [ ] Express API server
  - [ ] Health check endpoint
  - [ ] Subscribe endpoint (POST /subscribe)
  - [ ] Unsubscribe endpoint (GET /unsubscribe/:token)
  - [ ] Confirm endpoint (GET /confirm/:token)
- [ ] Public landing page
  - [ ] Simple subscribe form
  - [ ] Newsletter archive / past issues
- [ ] Double opt-in flow
  - [ ] Confirmation email on subscribe
  - [ ] Status: pending → active on confirm
- [ ] Unsubscribe handling
  - [ ] One-click unsubscribe link in every newsletter
  - [ ] List-Unsubscribe header

## Phase 4: Automation & Admin

- [ ] Scheduled cron jobs on Railway
  - [ ] Daily: poll emails + RSS
  - [ ] Daily: summarize + categorize new articles
  - [ ] Weekly: send newsletter (or manual trigger)
- [ ] Admin dashboard (simple web UI)
  - [ ] View ingested articles
  - [ ] Select/reject articles for next issue
  - [ ] Preview newsletter before sending
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
