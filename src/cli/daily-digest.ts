#!/usr/bin/env node
import "../config.js"; // Load .env
import { pollRssFeeds } from "../services/ingestion/rss-poller.js";
import { pollEmails, identifySource } from "../services/ingestion/email-poller.js";
import { extractArticles } from "../services/ingestion/article-extractor.js";
import { summarizeArticle } from "../services/processing/summarizer.js";
import { categorizeArticle } from "../services/processing/categorizer.js";
import { createArticle, getAllArticles, updateArticleSummary, updateArticleCategories } from "../models/article.js";
import { checkDuplicate } from "../services/ingestion/deduplicator.js";
import { closeDatabase } from "../db/index.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Article } from "../models/article.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/daily-digest.ts [options]

Runs the full pipeline and writes a markdown digest:
  1. Poll RSS feeds
  2. Poll email newsletters (if GMAIL_APP_PASSWORD set)
  3. Summarize new articles (if CLAUDE_API_KEY set)
  4. Categorize new articles (if CLAUDE_API_KEY set)
  5. Write markdown digest to output/

Options:
  --dry-run       Run pipeline but don't store articles or write file
  --skip-emails   Skip email polling even if credentials are set
  --skip-llm      Skip summarization and categorization
  --output <dir>  Output directory (default: ./output)
  --help          Show this help message

Examples:
  npx tsx src/cli/daily-digest.ts
  npx tsx src/cli/daily-digest.ts --skip-emails
  npx tsx src/cli/daily-digest.ts --dry-run
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") result.dryRun = "true";
    if (args[i] === "--skip-emails") result.skipEmails = "true";
    if (args[i] === "--skip-llm") result.skipLlm = "true";
    if (args[i] === "--help") result.help = "true";
    if (args[i] === "--output" && args[i + 1]) {
      result.output = args[i + 1];
      i++;
    }
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function generateMarkdown(articles: Article[], date: string): string {
  const lines: string[] = [];

  lines.push(`# AI News Digest - ${date}`);
  lines.push("");
  lines.push(`*${articles.length} article(s) collected*`);
  lines.push("");

  // Group articles by category
  const byCategory = new Map<string, Article[]>();
  const uncategorized: Article[] = [];

  for (const article of articles) {
    if (article.categories.length === 0) {
      uncategorized.push(article);
    } else {
      for (const cat of article.categories) {
        const list = byCategory.get(cat) || [];
        list.push(article);
        byCategory.set(cat, list);
      }
    }
  }

  // Sort categories alphabetically
  const sortedCategories = [...byCategory.keys()].sort();

  for (const category of sortedCategories) {
    const catArticles = byCategory.get(category)!;
    lines.push(`## ${category}`);
    lines.push("");

    for (const article of catArticles) {
      const url = article.originalUrl ? ` ([link](${article.originalUrl}))` : "";
      lines.push(`### ${article.title}${url}`);
      lines.push(`*Source: ${article.source}*`);
      lines.push("");

      if (article.summary) {
        lines.push(article.summary);
      } else {
        // Show a truncated version of raw content
        const preview = article.rawContent.slice(0, 300).trim();
        lines.push(preview + (article.rawContent.length > 300 ? "..." : ""));
      }
      lines.push("");
    }
  }

  if (uncategorized.length > 0) {
    lines.push(`## Uncategorized`);
    lines.push("");

    for (const article of uncategorized) {
      const url = article.originalUrl ? ` ([link](${article.originalUrl}))` : "";
      lines.push(`### ${article.title}${url}`);
      lines.push(`*Source: ${article.source}*`);
      lines.push("");

      if (article.summary) {
        lines.push(article.summary);
      } else {
        const preview = article.rawContent.slice(0, 300).trim();
        lines.push(preview + (article.rawContent.length > 300 ? "..." : ""));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const dryRun = args.dryRun === "true";
  const skipEmails = args.skipEmails === "true";
  const skipLlm = args.skipLlm === "true";
  const outputDir = args.output || "./output";
  const today = formatDate(new Date());

  if (dryRun) {
    console.log("DRY RUN MODE\n");
  }

  const newArticleIds: string[] = [];

  // ── Step 1: Poll RSS feeds ──────────────────────────────────
  console.log("═══ Step 1: Polling RSS feeds ═══\n");

  try {
    const rssArticles = await pollRssFeeds();

    let stored = 0;
    let skipped = 0;

    for (const article of rssArticles) {
      const dup = checkDuplicate(article.url, article.title);
      if (dup) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        const created = createArticle({
          source: article.source,
          sourceType: "rss",
          title: article.title,
          originalUrl: article.url,
          rawContent: article.content,
          publishedAt: article.publishedAt,
        });
        newArticleIds.push(created.id);
        stored++;
      } else {
        stored++;
      }
    }

    console.log(`  Found: ${rssArticles.length}, New: ${stored}, Duplicates: ${skipped}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  RSS polling error: ${message}\n`);
  }

  // ── Step 2: Poll emails (optional) ─────────────────────────
  if (!skipEmails && process.env.GMAIL_APP_PASSWORD) {
    console.log("═══ Step 2: Polling email newsletters ═══\n");

    try {
      const newsletters = await pollEmails({ markAsRead: !dryRun });

      let totalStored = 0;

      for (const newsletter of newsletters) {
        const source = identifySource(newsletter.from);
        const extracted = extractArticles(newsletter.html || newsletter.text, source);

        for (const article of extracted) {
          const dup = checkDuplicate(article.url || "", article.title);
          if (dup) continue;

          if (!dryRun) {
            const created = createArticle({
              source,
              sourceType: "email",
              title: article.title,
              originalUrl: article.url,
              rawContent: article.content,
              publishedAt: newsletter.date,
            });
            newArticleIds.push(created.id);
            totalStored++;
          } else {
            totalStored++;
          }
        }
      }

      console.log(`  Newsletters: ${newsletters.length}, New articles: ${totalStored}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Email polling error: ${message}\n`);
    }
  } else {
    console.log("═══ Step 2: Skipping email polling (no credentials or --skip-emails) ═══\n");
  }

  // ── Step 3: Summarize new articles ─────────────────────────
  if (!skipLlm && process.env.CLAUDE_API_KEY) {
    console.log("═══ Step 3: Summarizing articles ═══\n");

    const allArticles = getAllArticles();
    const toSummarize = allArticles.filter((a) => !a.summary);

    if (toSummarize.length === 0) {
      console.log("  No articles need summarization.\n");
    } else {
      console.log(`  Summarizing ${toSummarize.length} article(s)...\n`);

      let summarized = 0;
      for (const article of toSummarize) {
        try {
          const summary = await summarizeArticle(article.rawContent, article.title);

          if (!dryRun) {
            updateArticleSummary(article.id, summary);
          }

          summarized++;
          console.log(`  ✓ ${article.title.slice(0, 60)}${article.title.length > 60 ? "..." : ""}`);

          // Rate limiting
          if (toSummarize.indexOf(article) < toSummarize.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ ${article.title.slice(0, 40)}: ${message}`);
        }
      }

      console.log(`\n  Summarized: ${summarized}/${toSummarize.length}\n`);
    }

    // ── Step 4: Categorize new articles ────────────────────────
    console.log("═══ Step 4: Categorizing articles ═══\n");

    const allArticles2 = getAllArticles();
    const toCategorize = allArticles2.filter((a) => a.categories.length === 0);

    if (toCategorize.length === 0) {
      console.log("  No articles need categorization.\n");
    } else {
      console.log(`  Categorizing ${toCategorize.length} article(s)...\n`);

      let categorized = 0;
      for (const article of toCategorize) {
        try {
          const categories = await categorizeArticle(article.rawContent, article.title);

          if (!dryRun) {
            updateArticleCategories(article.id, categories);
          }

          categorized++;
          console.log(`  ✓ ${article.title.slice(0, 50)}: ${categories.join(", ")}`);

          // Rate limiting
          if (toCategorize.indexOf(article) < toCategorize.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ ${article.title.slice(0, 40)}: ${message}`);
        }
      }

      console.log(`\n  Categorized: ${categorized}/${toCategorize.length}\n`);
    }
  } else {
    console.log("═══ Steps 3-4: Skipping LLM processing (no CLAUDE_API_KEY or --skip-llm) ═══\n");
  }

  // ── Step 5: Generate markdown digest ───────────────────────
  console.log("═══ Step 5: Generating digest ═══\n");

  // Get today's articles (ingested today)
  const allArticles = getAllArticles();
  const todayArticles = allArticles.filter((a) => formatDate(a.ingestedAt) === today);

  // If no articles ingested today, fall back to all pending articles
  const digestArticles = todayArticles.length > 0 ? todayArticles : allArticles.filter((a) => a.curationStatus === "pending");

  if (digestArticles.length === 0) {
    console.log("  No articles to include in digest.\n");
  } else {
    const markdown = generateMarkdown(digestArticles, today);
    const filename = `${today}-digest.md`;

    if (!dryRun) {
      mkdirSync(outputDir, { recursive: true });
      const filepath = join(outputDir, filename);
      writeFileSync(filepath, markdown, "utf-8");
      console.log(`  Written: ${filepath}`);
    } else {
      console.log(`  Would write: ${join(outputDir, filename)}`);
    }

    console.log(`  Articles in digest: ${digestArticles.length}\n`);

    // Print a quick summary to console
    console.log("── Digest Preview ──\n");
    for (const article of digestArticles.slice(0, 10)) {
      const summary = article.summary ? article.summary.slice(0, 100) + "..." : "(no summary)";
      console.log(`  • [${article.source}] ${article.title}`);
      console.log(`    ${summary}`);
    }
    if (digestArticles.length > 10) {
      console.log(`\n  ... and ${digestArticles.length - 10} more article(s)`);
    }
  }

  console.log("\n═══ Done ═══\n");

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
