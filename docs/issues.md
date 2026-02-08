# Known Issues

Issues discovered during Phase 2 testing (2026-02-08).

## Parser Quality

### AlphaSignal parser produces duplicates
- Each newsletter yields duplicate articles (e.g. "1M token context window" x2, "OpenClaw" x2, "Key features" x2)
- Likely extracting the same article from both a preview section and the full section in the HTML
- **File:** `src/services/ingestion/article-extractor.ts` (extractAlphaSignal)

### AlphaSignal parser extracts generic titles
- Titles like "What it does", "Key features", "Key insights", "Models and features" are section headings, not article titles
- Should extract the actual product/topic name (e.g. "Claude for Xcode", "OpenAI Frontier", "NASA Perseverance AI")
- **File:** `src/services/ingestion/article-extractor.ts` (extractAlphaSignal)

### Welcome/onboarding emails parsed as articles
- The AlphaSignal confirmation email ("Welcome! Let's confirm your email!") was parsed and produced "STEP 1", "STEP 2", "STEP 3" articles
- Should detect and skip non-newsletter emails (confirmation, welcome, account emails)
- **File:** `src/services/ingestion/article-extractor.ts` or `src/cli/poll-emails.ts`

### The Batch parser only extracts 1 article
- "OpenClaw Runs Amok, Kimi's Open Model, Ministral Distilled, Wikipedia's Partners" should contain multiple articles but only "A MESSAGE FROM DEEPLEARNING.AI" was extracted
- **File:** `src/services/ingestion/article-extractor.ts` (extractTheBatch)

### Article URLs point to newsletter homepage
- 6 AlphaSignal articles share the same URL (`https://alphasignal.ai/?utm_source=email`) instead of linking to the actual article
- Deduplication by URL incorrectly groups unrelated articles together
- **File:** `src/services/ingestion/article-extractor.ts` (extractAlphaSignal)

## Deduplication

### No automatic dedup on ingestion
- `deduplicate-articles.ts` is read-only / informational — it reports duplicates but doesn't prevent or remove them
- The `checkDuplicate()` function exists in `src/services/ingestion/deduplicator.ts` but is not called during `poll-emails.ts` ingestion
- Duplicates are stored in the database and then summarized/categorized separately, wasting API calls

## Not Yet Tested

- RSS feed ingestion (`poll-rss.ts`) — dry-run worked (1,197 articles found), but not stored to DB yet
- Import AI parser (`extractImportAI`)
- The Rundown parser (`extractTheRundown`)
- Newsletter sending with real summarized/categorized articles
