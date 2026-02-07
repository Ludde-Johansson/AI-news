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
│                     PROCESSING PIPELINE                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐   │
│  │ Extract  │──▶│ LLM Summarize│──▶│ Human Curation         │   │
│  │ Articles │   │ & Categorize │   │ (select for digest)    │   │
│  └──────────┘   └──────────────┘   └────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STORAGE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Articles     │  │ Subscribers  │  │ Newsletter Issues    │   │
│  │ (raw+summary)│  │ (email list) │  │ (sent digests)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DELIVERY                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Email (Resend)              │ PWA (secondary)            │   │
│  │ - Daily digest to subs      │ - Personal reading         │   │
│  │ - Unsubscribe handling      │ - Archive view             │   │
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
  summary: string; // LLM-generated
  categories: string[]; // ["llm", "safety", "research"]
  curationStatus: "pending" | "selected" | "rejected" | "published";
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
│   └── schema.ts           # SQLite tables
├── models/
│   ├── article.ts
│   ├── subscriber.ts
│   └── newsletter-issue.ts
├── services/
│   ├── ingestion/          # Email parser, RSS poller
│   ├── processing/         # Claude summarization
│   └── newsletter/         # Generator, sender
├── templates/
│   └── newsletter.tsx      # React Email template
├── api/
│   └── routes/             # Express endpoints
└── cli/
    ├── add-article.ts
    ├── add-subscriber.ts
    ├── select-article.ts
    ├── send-newsletter.ts
    └── poll-emails.ts      # Phase 2: Fetch newsletters via IMAP
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

## Implementation Phases

1. **Phase 1:** Foundation + Manual Newsletter (CLI scripts, basic send)
2. **Phase 2:** Content Pipeline (email ingestion, RSS, Claude summarization)
3. **Phase 3:** Subscriber Growth (landing page, double opt-in, analytics)
4. **Phase 4:** Automation (scheduling, cron jobs, dashboard)
5. **Phase 5:** PWA + Polish (archive, improved admin UI)
