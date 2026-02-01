# Architecture

Detailed technical reference for the AI News Newsletter.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Email Webhook   │ RSS Poller      │ Manual Entry                │
│ (newsletters)   │ (blogs)         │ (CLI)                       │
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

### Mailgun Inbound Routes

1. Configure Mailgun route to forward to `/api/ingest/email`
2. Forward newsletters to Mailgun address
3. Webhook receives parsed email (sender, subject, body-html)

### Webhook Payload

```json
{
  "sender": "newsletter@thebatch.com",
  "subject": "The Batch: AI News",
  "body-html": "<html>...",
  "body-plain": "Plain text..."
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
    └── send-newsletter.ts
```

## Environment Variables

```bash
RESEND_API_KEY=re_xxx
MAILGUN_API_KEY=key-xxx        # Phase 2
ANTHROPIC_API_KEY=sk-ant-xxx   # Phase 2
DATABASE_PATH=./data/ai-news.db
BASE_URL=https://your-domain.com
```

## Implementation Phases

1. **Phase 1:** Foundation + Manual Newsletter (CLI scripts, basic send)
2. **Phase 2:** Content Pipeline (email ingestion, RSS, Claude summarization)
3. **Phase 3:** Subscriber Growth (landing page, double opt-in, analytics)
4. **Phase 4:** Automation (scheduling, cron jobs, dashboard)
5. **Phase 5:** PWA + Polish (archive, improved admin UI)
