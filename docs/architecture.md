# Architecture

Detailed technical reference for the AI News Newsletter.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Email Poller    │ RSS Poller      │ Manual Entry                │
│ (IMAP/Gmail)    │ (blogs)         │ (CLI)                       │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ENRICHMENT (per-article LLM)                │
│  ┌──────────┐   ┌──────────────────────────────────────────┐    │
│  │ Extract  │──▶│ Enricher (1 LLM call per article)       │    │
│  │ Articles │   │ → summary, categories, score, actionable │    │
│  └──────────┘   └──────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     COMPOSITION (rule-based + 1 LLM call)       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ HN Trending  │  │ Score Sort   │  │ Top Story Pick       │   │
│  │ Detection    │  │ + Tag/Badge  │  │ (batch LLM call)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STORAGE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Articles     │  │ Subscribers  │  │ Newsletter Issues    │   │
│  │ (enriched)   │  │ (email list) │  │ (sent digests)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DELIVERY                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Email (Resend)              │ PWA (secondary)            │   │
│  │ - Composed digest           │ - Personal reading         │   │
│  │ - Top Story + Try This      │ - Archive view             │   │
│  │ - Flat ranked list w/ tags  │                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Article

```typescript
interface Article {
  id: string;
  source: string; // "the-batch", "alphasignal", etc.
  sourceType: "email" | "rss" | "manual";
  originalUrl: string;
  title: string;
  rawContent: string;
  summary: string; // LLM-generated (via enricher)
  categories: string[]; // ["llm", "safety", "research"] (via enricher)
  curationStatus: "pending" | "selected" | "rejected" | "published";
  relevanceScore: number | null; // 1-10 (via enricher)
  isActionable: boolean; // "Try This" flag (via enricher)
  publishedAt: Date;
  ingestedAt: Date;
}
```

### Subscriber

```typescript
interface Subscriber {
  id: string;
  email: string;
  status: "pending" | "active" | "unsubscribed";
  unsubscribeToken: string;
  subscribedAt: Date;
  confirmedAt?: Date;
}
```

### NewsletterIssue

```typescript
interface NewsletterIssue {
  id: string;
  issueNumber: number;
  title: string;
  articleIds: string[];
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: Date;
  sentAt?: Date;
}
```

## Content Sources

### Email Newsletters

| Newsletter            | Format     | Frequency |
| --------------------- | ---------- | --------- |
| The Batch (Andrew Ng) | HTML email | Weekly    |
| AlphaSignal           | HTML email | Daily     |
| Datapoints            | HTML email | Varies    |

### RSS/Web Sources

| Source         | URL                  | Frequency |
| -------------- | -------------------- | --------- |
| Anthropic Blog | anthropic.com/news   | Irregular |
| OpenAI Blog    | openai.com/blog      | Irregular |
| DeepMind Blog  | deepmind.google/blog | Irregular |

## Email Ingestion (Phase 2)

### IMAP Polling Approach

Instead of webhooks, we poll a dedicated Gmail inbox via IMAP:

1. **Gmail account:** `ludvig.ai.newsletter@gmail.com`
2. **Subscribe** to newsletters (The Batch, AlphaSignal, etc.) with this email
3. **Poll** inbox via IMAP on-demand or via cron
4. **Parse** emails and extract articles
5. **Mark as read** after processing to avoid duplicates

### Gmail Setup

1. Enable IMAP in Gmail settings
2. Create an App Password (requires 2FA enabled):
   - Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail" app
3. Store credentials in `.env`

### Polling Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ IMAP Connect│────▶│ Fetch Unread│────▶│ Parse Email │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │ Mark as Read│◀────│ Store       │
                    └─────────────┘     │ Articles    │
                                        └─────────────┘
```

### Parsed Email Structure

```typescript
interface ParsedNewsletter {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  html: string;
  text: string;
}
```

## Project Structure

```
src/
├── db/
│   ├── index.ts            # Database connection
│   └── schema.ts           # SQLite tables (with migration support)
├── models/
│   ├── article.ts          # Article CRUD + enrichment queries
│   ├── subscriber.ts
│   └── newsletter-issue.ts
├── services/
│   ├── ingestion/          # Email parser, RSS poller, deduplication
│   ├── processing/
│   │   ├── enricher.ts     # Unified per-article LLM enrichment
│   │   ├── summarizer.ts   # Legacy: summary-only
│   │   └── categorizer.ts  # Legacy: categories-only
│   ├── trending/
│   │   └── hn-trending.ts  # HN top stories cross-reference
│   └── newsletter/
│       ├── composer.ts     # Rule-based newsletter assembly
│       ├── sender.ts       # Email delivery (legacy + composed)
│       └── template.ts     # HTML/text templates (legacy + composed)
├── api/
│   └── routes/
│       ├── articles.ts     # Article management endpoints
│       └── pipeline.ts     # Pipeline: enrich, compose, send-composed, run-all
└── cli/
    ├── add-article.ts
    ├── add-subscriber.ts
    ├── select-article.ts
    ├── send-newsletter.ts
    ├── daily-digest.ts     # Full pipeline: poll → enrich → trend → compose
    └── poll-emails.ts
```

## Environment Variables

```bash
RESEND_API_KEY=re_xxx
GMAIL_USER=ludvig.ai.newsletter@gmail.com
GMAIL_APP_PASSWORD=xxxx         # Phase 2: Gmail App Password
ANTHROPIC_API_KEY=sk-ant-xxx    # Phase 2: For summarization
DATABASE_PATH=./data/ai-news.db
BASE_URL=https://your-domain.com
```

## Newsletter Feed Design

### Design Decisions

| Problem | Decision | Approach |
|---------|----------|----------|
| **Ranking** | B+ | Per-article LLM scoring + small batch call for editorial top story pick |
| **Sections** | D | Flat ranked list with inline tags, no rigid section divisions |
| **Trending** | A | HN API top stories cross-referenced with our articles |
| **Try This** | C | Flagged during enrichment (isActionable), no extra LLM call |
| **Architecture** | B | Enriched per-article + rule-based composer |

### Enrichment Pipeline

Each article gets a single LLM call that returns:
- **Summary** (2-3 sentences)
- **Categories** (1-3 from predefined list)
- **Relevance score** (1-10, for developer/AI audience)
- **Actionable flag** (is this something you can try today?)

This replaces the previous two-step summarize + categorize pipeline, saving one LLM call per article.

### Newsletter Composition

The composer is rule-based (no LLM), with one exception:

1. **Sort** articles by relevance_score DESC
2. **Mark trending** articles (from HN matches)
3. **Pick "Try This"** = highest-scored article with isActionable=true
4. **Pick "Top Story"** = small batch LLM call reviews top ~10 articles, selects lead story + writes 1-sentence editorial intro
5. **Output** = flat ranked list with tags and badges

### Newsletter Format

```
┌─ TOP STORY (blue highlight) ─────────────────────────┐
│ [Editorial intro]                                     │
│ Article title + summary + tags                        │
└───────────────────────────────────────────────────────┘

┌─ TRY THIS (green highlight) ─────────────────────────┐
│ Article title + summary + [Try This] [Tools] tags     │
└───────────────────────────────────────────────────────┘

── MORE STORIES ────────────────────────────────────────
  Article 3: title + summary + [Research] [Trending]
  Article 4: title + summary + [LLM] [Business]
  Article 5: title + summary + [Safety]
  ...
```

### HN Trending Detection

- Fetch top 30 HN stories via Firebase API
- Extract keywords from titles (3+ chars, no stop words)
- Match against article titles (40%+ keyword overlap)
- Articles matching HN stories get a "Trending" badge

### Future Ideas (Documented for Later)

**Multi-signal scoring rubric (Ranking Option D):**
Instead of a single LLM relevance score, score each dimension separately:
- Source authority (heuristic: Anthropic blog > random RSS)
- Recency (heuristic: today > 3 days ago)
- Topic relevance (LLM or embedding)
- Novelty (LLM: genuinely new vs incremental)
- Cross-source overlap (heuristic: if 3+ sources cover it, it's big)
Weighted combination → final score. Fully transparent and tunable.

**Profile-driven personalization:**
Define a reader profile in config:
```json
{
  "interests": ["coding assistants", "AI agents", "developer tools", "AI safety"],
  "less_interested": ["robotics", "computer vision", "gaming"],
  "preferred_sources": ["anthropic", "cursor", "vercel"],
  "newsletter_style": "concise with sections"
}
```
Feed this to the LLM alongside articles. The profile drives ranking, sections, and which articles to include. Could support multiple profiles for different audience segments later.

**Internal cross-source trending (Alternative to HN):**
If the same topic appears in 3+ ingested sources within 24-48 hours, it's trending.
Zero external dependencies. Strong signal — if The Batch, AlphaSignal, AND the OpenAI blog all mention the same thing, it's clearly big news. Needs fuzzy topic matching (LLM or embedding-based).

## Implementation Phases

1. **Phase 1:** Foundation + Manual Newsletter (CLI scripts, basic send)
2. **Phase 2:** Content Pipeline (email ingestion, RSS, Claude summarization)
3. **Phase 3:** Subscriber Growth (landing page, double opt-in, analytics)
4. **Phase 4:** Automation (scheduling, cron jobs, dashboard)
5. **Phase 5:** PWA + Polish (archive, improved admin UI)
