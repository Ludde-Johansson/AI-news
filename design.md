# AI News Aggregator - Design Document

## Problem Statement

AI/ML news is scattered across newsletters and sources. Current solutions either:

- Clutter your inbox
- Aren't personalized to your interests
- Don't learn from your behavior

## Solution Overview

A personal news aggregator that:

1. Ingests content from multiple sources (email newsletters, RSS, blogs)
2. Uses an LLM to summarize and score relevance
3. Presents a daily digest via PWA
4. Learns preferences from user feedback

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Email Webhook   │ RSS Poller      │ Web Scraper                 │
│ (newsletters)   │ (blogs, reddit) │ (sites without RSS)         │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSING PIPELINE                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐   │
│  │ Extract  │──▶│ LLM Summarize│──▶│ Score Relevance        │   │
│  │ Articles │   │ & Categorize │   │ (based on preferences) │   │
│  └──────────┘   └──────────────┘   └────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STORAGE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Articles     │  │ User Prefs   │  │ Feedback History     │   │
│  │ (raw+summary)│  │ (learned)    │  │ (clicks, ratings)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PWA Daily Digest                                         │   │
│  │ - Article cards with summaries                           │   │
│  │ - Click to expand / go to source                         │   │
│  │ - Feedback buttons (👍 👎 🔄)                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Article

```typescript
interface Article {
  id: string;
  source: string; // "the-batch", "alphasignal", "anthropic-blog"
  sourceType: "email" | "rss" | "scrape";
  originalUrl: string;
  title: string;
  rawContent: string; // Original content (HTML or text)
  summary: string; // LLM-generated summary
  categories: string[]; // e.g., ["llm", "safety", "research"]
  relevanceScore: number; // 0-1, based on user preferences
  publishedAt: Date;
  ingestedAt: Date;
}
```

### Feedback

```typescript
interface Feedback {
  id: string;
  articleId: string;
  type: "thumbs_up" | "thumbs_down" | "bad_summary" | "click_through";
  timestamp: Date;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  // Learned from feedback over time
  topicWeights: Record<string, number>; // e.g., { "safety": 0.8, "hype": -0.5 }
  sourceWeights: Record<string, number>; // e.g., { "the-batch": 0.9, "alphasignal": 0.7 }

  // Explicit settings
  digestFrequency: "daily" | "weekly";
  digestTime: string; // e.g., "08:00"
}
```

---

## Content Sources

### Email Newsletters (Initial)

| Newsletter            | Format     | Notes                       |
| --------------------- | ---------- | --------------------------- |
| The Batch (Andrew Ng) | HTML email | Weekly, well-structured     |
| AlphaSignal           | HTML email | Daily, multiple short items |
| Datapoints            | HTML email |                             |
| ML Safety Newsletter  | HTML email | Monthly/irregular           |

### RSS/Web Sources (Initial)

| Source         | URL                  | Frequency |
| -------------- | -------------------- | --------- |
| Anthropic Blog | anthropic.com/news   | Irregular |
| OpenAI Blog    | openai.com/blog      | Irregular |
| DeepMind Blog  | deepmind.google/blog | Irregular |

---

## Feedback System

### Explicit Feedback

- 👍 **Thumbs up**: Relevant content, good summary
- 👎 **Thumbs down**: Not interested in this
- 🔄 **Bad summary**: Topic is relevant but summary missed the point

### Implicit Feedback

- **Click-through**: User clicked to read original → strong positive signal
- **Time on card**: Future enhancement, requires more JS tracking

### How Feedback Affects Relevance

1. Thumbs up on article → boost weight for its categories and source
2. Thumbs down → reduce weight for categories (not source, content might just be off-topic)
3. Click-through → strong boost to source and categories
4. Bad summary → flag for prompt improvement, no relevance change

---

## Tech Stack

| Component           | Choice                      | Rationale                                         |
| ------------------- | --------------------------- | ------------------------------------------------- |
| **Backend**         | Node.js + TypeScript        | Preference, JS everywhere                         |
| **Database**        | SQLite (via better-sqlite3) | Simple, no server needed, easy to start           |
| **LLM**             | Claude API                  | Good at summarization                             |
| **Email ingestion** | Mailgun Inbound Routes      | Free tier, webhook-based, no domain needed        |
| **Hosting**         | Railway.app                 | Easy deploy, has cron, persistent disk, free tier |
| **PWA Framework**   | Vanilla JS or Svelte        | Keep it simple                                    |
| **Notifications**   | Pushover or Ntfy            | TBD - later phase                                 |

---

## Email Ingestion Setup

### Mailgun Inbound Routes

1. Sign up at mailgun.com
2. Get a free receiving address: `anything@sandboxXXXX.mailgun.org`
3. Configure route: forward to `https://your-app.railway.app/api/ingest/email`
4. Forward your newsletters to the Mailgun address

Mailgun POSTs parsed email data (sender, subject, body-plain, body-html) to your webhook.

### Webhook Payload (simplified)

```json
{
  "sender": "newsletter@thebatch.com",
  "subject": "The Batch: AI News for March 2025",
  "body-html": "<html>...",
  "body-plain": "Plain text version..."
}
```

---

## MVP Scope

### Phase 1: Project Setup + Manual Flow

- [ ] Initialize Node.js + TypeScript project
- [ ] Set up SQLite database with schema
- [ ] Create CLI script to manually add test articles
- [ ] Basic Express API to serve articles
- [ ] Minimal PWA that displays article list
- [ ] Feedback buttons (stored in DB)

### Phase 2: Email Ingestion

- [ ] Set up Mailgun account + inbound route
- [ ] `/api/ingest/email` webhook endpoint
- [ ] Email HTML parsing (extract articles from newsletters)
- [ ] LLM summarization pipeline
- [ ] Deploy to Railway

### Phase 3: RSS + More Sources

- [ ] RSS feed poller (cron job on Railway)
- [ ] Add Anthropic, OpenAI, DeepMind blogs
- [ ] Web scraping fallback for sites without RSS

### Phase 4: Personalization

- [ ] Use feedback to calculate topic/source weights
- [ ] Relevance scoring based on learned preferences
- [ ] Improve prompts based on "bad summary" feedback

### Phase 5: Polish

- [ ] Push notifications for breaking news (Pushover/Ntfy)
- [ ] Better PWA UI/UX
- [ ] Historical view / search
- [ ] Add to homescreen prompt

---

## Notes

- Keep it simple. This is a personal tool, not a product.
- Prefer boring technology that works.
- Can always add complexity later if needed.
