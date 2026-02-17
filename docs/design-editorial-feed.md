# Design: Editorial Feed with Ranking & Sections

## Overview

Transform the newsletter from a flat categorized list into a **curated, sectioned digest** with ranking, a "Try This" spotlight, and viral/trending detection.

## Newsletter Sections

Replace the current 10 generic categories with 5 newsletter sections:

| Section | What goes here | Target count |
|---------|---------------|--------------|
| **AI for Programming** | Coding assistants, dev tools, IDE updates, agents for code, code generation | 3-5 articles |
| **Industry & Business** | Funding rounds, acquisitions, product launches, company strategy, big announcements | 3-5 articles |
| **Research & Breakthroughs** | Papers, new architectures, benchmarks, model releases | 2-4 articles |
| **Policy & Safety** | Regulation, alignment research, governance, responsible AI, ethics | 1-3 articles |
| **Trending Now** | What the tech/AI community is talking about right now — based on HN/Reddit signals | 1-2 articles |

Plus two special slots (not sections per se, but highlighted boxes):

| Slot | Purpose | Count |
|------|---------|-------|
| **Try This** | A specific tool, update, or product the reader should try today | 1-2 items |
| **Top Story** | The single most important story of the day, shown at the top with extra context | 1 item |

## Architecture Changes

### Current pipeline

```
ingest → summarize (per article) → categorize (per article) → manual curation → send
```

### New pipeline

```
ingest → summarize (per article) → EDITORIAL PASS (batch) → manual curation → send
                                         │
                                         ├── assigns newsletter section
                                         ├── scores relevance (1-10)
                                         ├── picks Top Story
                                         ├── picks Try This (1-2)
                                         └── flags trending (cross-ref w/ HN)
```

The **editorial pass** replaces the current per-article categorizer. Instead of categorizing each article in isolation, we send ALL of the day's article summaries in a single LLM call and get back a structured editorial plan.

### Why a single batch call?

- An editor sees the full picture — you can't pick a "top story" without seeing all stories
- One API call instead of N (cheaper, faster)
- The LLM can compare articles against each other for ranking
- 20-30 article summaries easily fit in the context window (~3-4k tokens input)

## Implementation Plan

### Step 1: Add new fields to articles

**File: `src/db/schema.ts`**

Add a migration that adds columns:
```sql
ALTER TABLE articles ADD COLUMN newsletter_section TEXT;
ALTER TABLE articles ADD COLUMN relevance_score INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN editorial_flags TEXT NOT NULL DEFAULT '[]';
```

- `newsletter_section`: One of `ai-programming`, `industry-business`, `research`, `policy-safety`, `trending`, or `null` (unassigned)
- `relevance_score`: 1-10, used for ordering within sections
- `editorial_flags`: JSON array, e.g. `["top-story"]`, `["try-this"]`, `[]`

**File: `src/models/article.ts`**

Add the new fields to the `Article` interface and update `rowToArticle`, `CreateArticleInput`, etc. Add helpers:
- `updateArticleEditorial(id, section, score, flags)`
- `getArticlesBySection(section)`

### Step 2: Add HN trending source

**New file: `src/services/ingestion/hn-poller.ts`**

Use the public HN API (no auth needed):
- `https://hacker-news.firebaseio.com/v0/topstories.json` → top 500 story IDs
- `https://hacker-news.firebaseio.com/v0/item/{id}.json` → story details
- Fetch top ~30 stories, filter to AI-related by keyword matching on titles
- Return `{ title, url, score, commentCount }[]`

This is NOT ingested as articles. It's used as **signal** — the editorial pass receives the trending HN titles alongside the article summaries, so it can identify overlap.

Also consider: Reddit r/MachineLearning (append `.json` to the URL, no auth needed for read). Lower priority — HN alone is a strong signal.

### Step 3: Build the editorial pass

**New file: `src/services/processing/editorial.ts`**

Single function: `runEditorialPass(articles: Article[], trendingSignals: HnStory[]): EditorialPlan`

Input to the LLM (one call):
```
System: You are the editor of an AI newsletter. Given today's articles and
what's trending on Hacker News, produce an editorial plan.

For each article, assign:
- section: one of "ai-programming", "industry-business", "research", "policy-safety", "trending"
- relevance_score: 1-10 (10 = must-read)
- flags: array, can include "top-story" (exactly 1 article), "try-this" (1-2 articles)

Also consider: if an article topic overlaps with a trending HN story, boost its
relevance and consider it for the "trending" section.

Respond with JSON only.
```

Output shape:
```typescript
interface EditorialPlan {
  articles: {
    articleId: string;
    section: NewsletterSection;
    relevanceScore: number;
    flags: ("top-story" | "try-this")[];
  }[];
}
```

### Step 4: Update the daily digest pipeline

**File: `src/cli/daily-digest.ts`**

Replace steps 3+4 (summarize + categorize separately) with:
1. Summarize articles that don't have summaries (keep as-is)
2. Fetch HN trending stories (new)
3. Run editorial pass on all unsectioned articles (new, replaces categorize)
4. Store editorial results back to DB

The old `categorizeArticle()` per-article calls get replaced by the single `runEditorialPass()` batch call.

### Step 5: Redesign the newsletter template

**File: `src/services/newsletter/template.ts`**

New structure:

```
┌─────────────────────────────────────────┐
│  AI NEWS DIGEST  #12 | Feb 17, 2026    │
├─────────────────────────────────────────┤
│  ★ TOP STORY                            │
│  [Title with larger font]               │
│  [Extended summary - 3-4 sentences]     │
│  [Source + link]                         │
├─────────────────────────────────────────┤
│  🔥 TRENDING NOW                        │
│  [1-2 articles overlapping with HN]     │
├─────────────────────────────────────────┤
│  ⌨️ AI FOR PROGRAMMING                  │
│  [Articles sorted by relevance score]   │
├─────────────────────────────────────────┤
│  🏢 INDUSTRY & BUSINESS                 │
│  [Articles sorted by relevance score]   │
├─────────────────────────────────────────┤
│  🔬 RESEARCH & BREAKTHROUGHS            │
│  [Articles sorted by relevance score]   │
├─────────────────────────────────────────┤
│  🛡️ POLICY & SAFETY                     │
│  [Articles sorted by relevance score]   │
├─────────────────────────────────────────┤
│  🧪 TRY THIS                            │
│  [1-2 tools/products, brief + link]     │
├─────────────────────────────────────────┤
│  footer / unsubscribe                   │
└─────────────────────────────────────────┘
```

Sections with 0 articles get omitted entirely. Within each section, articles are sorted by `relevance_score` descending.

### Step 6: Add new RSS sources

**File: `src/services/ingestion/rss-poller.ts`**

Add to `RSS_FEEDS`:

```typescript
// Developer/AI tooling blogs
{ name: "Vercel Blog", url: "https://vercel.com/atom", source: "vercel-blog" },
{ name: "Cursor Blog", url: "https://www.cursor.com/blog/rss.xml", source: "cursor-blog" },

// Thought leaders
{ name: "Lex Fridman Podcast", url: "https://lexfridman.com/feed/podcast/", source: "lex-fridman" },
{ name: "Peter Steinberger", url: "https://steipete.me/feed.xml", source: "peter-steinberger" },

// Additional AI sources
{ name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", source: "huggingface-blog" },
```

NOTE: RSS URLs need to be verified — some blogs don't have RSS or use different paths. We should verify each URL works before committing.

### Step 7: Wire it all into the API

**File: `src/api/` routes**

Add endpoint: `POST /api/pipeline/editorial` — triggers the editorial pass on pending articles. Update `POST /api/pipeline/run-all` to include the editorial step.

## What stays the same

- Ingestion layer (RSS + email polling) — no changes except new feeds
- Deduplication — no changes
- Summarizer — no changes (still per-article, still needed)
- Database (SQLite) — just new columns, no restructuring
- Subscriber model — no changes
- Newsletter sending via Resend — no changes
- CLI tools — mostly unchanged

## What gets removed

- `src/services/processing/categorizer.ts` — replaced by the editorial pass
- The `categories` field on articles still exists for backwards compat but becomes secondary to `newsletter_section`

## Open questions

1. **Should we keep the old `categories` field?** The editorial pass assigns sections, which are different from tags. We could keep categories as metadata (useful for filtering/search later) but they wouldn't drive the newsletter layout anymore. Recommendation: keep `categories` but stop using them in the template.

2. **How to handle slow news days?** If only 3 articles are ingested, the editorial pass might produce a sparse newsletter. Options: (a) skip sending, (b) pull from recent unsent articles, (c) lower the threshold per section. Recommendation: the editorial pass should work with whatever it gets — if there are only 3 articles, it assigns them to sections and that's fine.

3. **Manual curation still in the loop?** Currently articles need to be manually set to "selected" before they appear in the newsletter. With the editorial pass doing ranking, we could: (a) keep manual curation as final gate, (b) auto-select everything the editorial pass scores above a threshold (e.g. relevance >= 5). Recommendation: start with (a), move to (b) later.

4. **RSS URL verification** — Need to check that the new blog RSS feeds actually work before adding them. Some might need alternative URLs or may not have RSS at all.

## Estimated scope

| Step | Files changed | New files | Complexity |
|------|--------------|-----------|------------|
| 1. DB + model changes | 2 | 0 | Small |
| 2. HN poller | 0 | 1 | Small |
| 3. Editorial pass | 0 | 1 | Medium (prompt engineering) |
| 4. Pipeline update | 1 | 0 | Small |
| 5. Template redesign | 1 | 0 | Medium (HTML/CSS) |
| 6. New RSS sources | 1 | 0 | Small (needs URL verification) |
| 7. API wiring | 1-2 | 0 | Small |
