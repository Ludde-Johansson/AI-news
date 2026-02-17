#!/usr/bin/env node
import "../config.js"; // Load .env
import { pollRssFeeds } from "../services/ingestion/rss-poller.js";
import { pollEmails, identifySource } from "../services/ingestion/email-poller.js";
import { extractArticles } from "../services/ingestion/article-extractor.js";
import { enrichArticle } from "../services/processing/enricher.js";
import { detectTrending } from "../services/trending/hn-trending.js";
import { composeNewsletter } from "../services/newsletter/composer.js";
import {
  createArticle,
  getAllArticles,
  getUnenrichedArticles,
  getTopScoredArticles,
  updateArticleEnrichment,
} from "../models/article.js";
import { checkDuplicate } from "../services/ingestion/deduplicator.js";
import { closeDatabase } from "../db/index.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Article } from "../models/article.js";
import type { NewsletterPlan, ComposedArticle } from "../services/newsletter/composer.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/daily-digest.ts [options]

Runs the full pipeline and writes a markdown digest:
  1. Poll RSS feeds
  2. Poll email newsletters (if GMAIL_APP_PASSWORD set)
  3. Enrich new articles (if CLAUDE_API_KEY set) — summary, categories, score, actionable flag
  4. Detect trending via Hacker News
  5. Compose newsletter (top story, try this, ranked list)
  6. Write markdown digest to output/

Options:
  --dry-run       Run pipeline but don't store articles or write file
  --skip-emails   Skip email polling even if credentials are set
  --skip-llm      Skip enrichment (summarization, categorization, scoring)
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

function generateComposedMarkdown(plan: NewsletterPlan, date: string): string {
  const lines: string[] = [];

  lines.push(`# AI News Digest - ${date}`);
  lines.push("");
  lines.push(`*${plan.totalCount} article(s) collected, ranked by relevance*`);
  lines.push("");

  // Top Story
  if (plan.topStory) {
    lines.push("## Top Story");
    lines.push("");
    renderComposedArticleMd(lines, plan.topStory, plan.topStoryIntro);
  }

  // Try This
  if (plan.tryThis && !plan.tryThis.isTopStory) {
    lines.push("## Try This");
    lines.push("");
    renderComposedArticleMd(lines, plan.tryThis);
  }

  // Remaining articles
  const remaining = plan.articles.filter(
    (c) => !c.isTopStory && !(c.isTryThis && !c.isTopStory),
  );

  if (remaining.length > 0) {
    lines.push("## More Stories");
    lines.push("");

    for (const composed of remaining) {
      renderComposedArticleMd(lines, composed);
    }
  }

  return lines.join("\n");
}

function renderComposedArticleMd(
  lines: string[],
  composed: ComposedArticle,
  intro?: string | null,
): void {
  const article = composed.article;
  const url = article.originalUrl ? ` ([link](${article.originalUrl}))` : "";
  const badges: string[] = [];
  if (composed.isTrending) badges.push("`Trending`");
  if (composed.isTryThis) badges.push("`Try This`");
  for (const tag of composed.tags) badges.push(`\`${tag}\``);

  lines.push(`### ${article.title}${url}`);
  lines.push(`*Source: ${article.source}* | Score: ${article.relevanceScore}/10 | ${badges.join(" ")}`);
  lines.push("");

  if (intro) {
    lines.push(`> ${intro}`);
    lines.push("");
  }

  if (article.summary) {
    lines.push(article.summary);
  } else {
    const preview = article.rawContent.slice(0, 300).trim();
    lines.push(preview + (article.rawContent.length > 300 ? "..." : ""));
  }
  lines.push("");
}

// Legacy: flat markdown for unenriched articles
function generateLegacyMarkdown(articles: Article[], date: string): string {
  const lines: string[] = [];

  lines.push(`# AI News Digest - ${date}`);
  lines.push("");
  lines.push(`*${articles.length} article(s) collected*`);
  lines.push("");

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
  console.log("=== Step 1: Polling RSS feeds ===\n");

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
    console.log("=== Step 2: Polling email newsletters ===\n");

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
    console.log("=== Step 2: Skipping email polling (no credentials or --skip-emails) ===\n");
  }

  // ── Step 3: Enrich new articles ─────────────────────────────
  if (!skipLlm && process.env.CLAUDE_API_KEY) {
    console.log("=== Step 3: Enriching articles (summary + categories + score + actionable) ===\n");

    const toEnrich = getUnenrichedArticles();

    if (toEnrich.length === 0) {
      console.log("  No articles need enrichment.\n");
    } else {
      console.log(`  Enriching ${toEnrich.length} article(s)...\n`);

      let enriched = 0;
      for (const article of toEnrich) {
        try {
          const result = await enrichArticle(article.rawContent, article.title, article.source);

          if (!dryRun) {
            updateArticleEnrichment(article.id, result);
          }

          enriched++;
          const scoreStr = `[${result.relevanceScore}/10]`;
          const actionableStr = result.isActionable ? " [actionable]" : "";
          console.log(`  + ${scoreStr}${actionableStr} ${article.title.slice(0, 55)}${article.title.length > 55 ? "..." : ""}`);

          // Rate limiting
          if (toEnrich.indexOf(article) < toEnrich.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`  x ${article.title.slice(0, 40)}: ${message}`);
        }
      }

      console.log(`\n  Enriched: ${enriched}/${toEnrich.length}\n`);
    }
  } else {
    console.log("=== Step 3: Skipping enrichment (no CLAUDE_API_KEY or --skip-llm) ===\n");
  }

  // ── Step 4: Detect trending ─────────────────────────────────
  console.log("=== Step 4: Detecting trending via Hacker News ===\n");

  const topArticles = getTopScoredArticles(20);
  let trendingMatches;
  try {
    trendingMatches = await detectTrending(topArticles);
    if (trendingMatches.length > 0) {
      for (const match of trendingMatches) {
        console.log(`  ~ [HN ${match.hnScore}] ${match.articleTitle.slice(0, 60)}`);
      }
    } else {
      console.log("  No trending matches found.");
    }
  } catch {
    console.log("  HN trending detection failed (network issue?).");
    trendingMatches = [];
  }
  console.log("");

  // ── Step 5: Compose newsletter ──────────────────────────────
  console.log("=== Step 5: Composing newsletter ===\n");

  const enrichedArticles = getTopScoredArticles(15);

  if (enrichedArticles.length === 0) {
    // Fall back to legacy digest
    console.log("  No enriched articles. Falling back to legacy digest.\n");

    const allArticles = getAllArticles();
    const todayArticles = allArticles.filter((a) => formatDate(a.ingestedAt) === today);
    const digestArticles = todayArticles.length > 0 ? todayArticles : allArticles.filter((a) => a.curationStatus === "pending");

    if (digestArticles.length > 0) {
      const markdown = generateLegacyMarkdown(digestArticles, today);
      const filename = `${today}-digest.md`;

      if (!dryRun) {
        mkdirSync(outputDir, { recursive: true });
        const filepath = join(outputDir, filename);
        writeFileSync(filepath, markdown, "utf-8");
        console.log(`  Written: ${filepath}`);
      }
      console.log(`  Articles in digest: ${digestArticles.length}\n`);
    } else {
      console.log("  No articles to include in digest.\n");
    }
  } else {
    // Compose with the new system
    const plan = await composeNewsletter(enrichedArticles, trendingMatches, {
      skipLlm: skipLlm || !process.env.CLAUDE_API_KEY,
    });

    console.log(`  Top Story: ${plan.topStory?.article.title ?? "(none)"}`);
    if (plan.topStoryIntro) {
      console.log(`  > ${plan.topStoryIntro}`);
    }
    console.log(`  Try This: ${plan.tryThis?.article.title ?? "(none)"}`);
    console.log(`  Total articles: ${plan.totalCount}`);
    console.log(`  Trending: ${plan.articles.filter((c) => c.isTrending).length}`);
    console.log("");

    const markdown = generateComposedMarkdown(plan, today);
    const filename = `${today}-digest.md`;

    if (!dryRun) {
      mkdirSync(outputDir, { recursive: true });
      const filepath = join(outputDir, filename);
      writeFileSync(filepath, markdown, "utf-8");
      console.log(`  Written: ${filepath}`);
    } else {
      console.log(`  Would write: ${join(outputDir, filename)}`);
    }

    // Print digest preview
    console.log("\n-- Digest Preview --\n");
    for (const composed of plan.articles.slice(0, 10)) {
      const article = composed.article;
      const badges: string[] = [];
      if (composed.isTopStory) badges.push("TOP");
      if (composed.isTryThis) badges.push("TRY");
      if (composed.isTrending) badges.push("TRENDING");
      const badgeStr = badges.length > 0 ? ` [${badges.join(",")}]` : "";
      const summary = article.summary ? article.summary.slice(0, 80) + "..." : "(no summary)";
      console.log(`  ${composed.rank}. [${article.relevanceScore}/10]${badgeStr} ${article.title}`);
      console.log(`     ${summary}`);
    }
    if (plan.totalCount > 10) {
      console.log(`\n  ... and ${plan.totalCount - 10} more article(s)`);
    }
  }

  console.log("\n=== Done ===\n");

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
