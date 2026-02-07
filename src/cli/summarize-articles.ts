#!/usr/bin/env node
import { getAllArticles, updateArticleSummary } from "../models/article.js";
import { summarizeArticle } from "../services/processing/summarizer.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/summarize-articles.ts [options]

Options:
  --dry-run    Summarize but don't save to database
  --id <id>    Summarize a specific article by ID
  --help       Show this help message

Environment variables required:
  ANTHROPIC_API_KEY    Anthropic API key for Claude

Examples:
  npx tsx src/cli/summarize-articles.ts --dry-run
  npx tsx src/cli/summarize-articles.ts --id abc123
  ANTHROPIC_API_KEY=sk-ant-xxx npx tsx src/cli/summarize-articles.ts
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      result.dryRun = "true";
    }
    if (args[i] === "--help") {
      result.help = "true";
    }
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
    console.log("DRY RUN MODE - summaries will not be saved\n");
  }

  const allArticles = getAllArticles();

  let articles;
  if (args.id) {
    articles = allArticles.filter((a) => a.id === args.id);
    if (articles.length === 0) {
      console.error(`Article not found: ${args.id}`);
      closeDatabase();
      process.exit(1);
    }
  } else {
    articles = allArticles.filter((a) => !a.summary);
  }

  if (articles.length === 0) {
    console.log("No articles need summarization.");
    closeDatabase();
    return;
  }

  console.log(`Found ${articles.length} article(s) to summarize:\n`);

  let summarized = 0;

  for (const article of articles) {
    console.log(`Summarizing: ${article.title.slice(0, 60)}${article.title.length > 60 ? "..." : ""}`);

    try {
      const summary = await summarizeArticle(article.rawContent, article.title);

      console.log(`  Summary: ${summary.slice(0, 100)}${summary.length > 100 ? "..." : ""}\n`);

      if (!dryRun) {
        updateArticleSummary(article.id, summary);
        console.log("  Saved to database.\n");
      }

      summarized++;

      // Rate limiting: 500ms delay between API calls
      if (articles.indexOf(article) < articles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error summarizing: ${message}\n`);
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. Summarized ${summarized} article(s). Run without --dry-run to save.`);
  } else {
    console.log(`\nSummarized and saved ${summarized} article(s).`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
