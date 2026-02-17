#!/usr/bin/env node
import "../config.js"; // Load .env
import { getUnenrichedArticles, getAllArticles, updateArticleEnrichment } from "../models/article.js";
import { enrichArticle } from "../services/processing/enricher.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/enrich-articles.ts [options]

Enriches articles with a single LLM call per article:
  - 2-3 sentence summary
  - Categories (llm, safety, research, tools, etc.)
  - Relevance score (1-10)
  - Actionable flag (is this something you can try today?)

Options:
  --dry-run    Enrich but don't save to database
  --id <id>    Enrich a specific article by ID
  --all        Re-enrich all articles (even previously enriched)
  --help       Show this help message

Environment variables required:
  CLAUDE_API_KEY    Anthropic API key for Claude

Examples:
  npx tsx src/cli/enrich-articles.ts
  npx tsx src/cli/enrich-articles.ts --dry-run
  npx tsx src/cli/enrich-articles.ts --id abc123
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") result.dryRun = "true";
    if (args[i] === "--help") result.help = "true";
    if (args[i] === "--all") result.all = "true";
    if (args[i] === "--id" && args[i + 1]) {
      result.id = args[i + 1];
      i++;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const dryRun = args.dryRun === "true";

  if (dryRun) {
    console.log("DRY RUN MODE - results will not be saved\n");
  }

  let articles;
  if (args.id) {
    const all = getAllArticles();
    articles = all.filter((a) => a.id === args.id);
    if (articles.length === 0) {
      console.error(`Article not found: ${args.id}`);
      closeDatabase();
      process.exit(1);
    }
  } else if (args.all) {
    articles = getAllArticles();
  } else {
    articles = getUnenrichedArticles();
  }

  if (articles.length === 0) {
    console.log("No articles need enrichment.");
    closeDatabase();
    return;
  }

  console.log(`Found ${articles.length} article(s) to enrich:\n`);

  let enriched = 0;

  for (const article of articles) {
    console.log(`Enriching: ${article.title.slice(0, 60)}${article.title.length > 60 ? "..." : ""}`);

    try {
      const result = await enrichArticle(article.rawContent, article.title, article.source);

      console.log(`  Score: ${result.relevanceScore}/10`);
      console.log(`  Categories: ${result.categories.join(", ")}`);
      console.log(`  Actionable: ${result.isActionable ? "yes" : "no"}`);
      console.log(`  Summary: ${result.summary.slice(0, 100)}${result.summary.length > 100 ? "..." : ""}\n`);

      if (!dryRun) {
        updateArticleEnrichment(article.id, result);
        console.log("  Saved to database.\n");
      }

      enriched++;

      // Rate limiting: 500ms delay between API calls
      if (articles.indexOf(article) < articles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error enriching: ${message}\n`);
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. Enriched ${enriched} article(s). Run without --dry-run to save.`);
  } else {
    console.log(`\nEnriched and saved ${enriched} article(s).`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
