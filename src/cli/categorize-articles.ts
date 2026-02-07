#!/usr/bin/env node
import {
  getAllArticles,
  updateArticleCategories,
} from "../models/article.js";
import { categorizeArticle } from "../services/processing/categorizer.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/categorize-articles.ts [options]

Options:
  --dry-run    Categorize but don't save to database
  --id <id>    Categorize a specific article by ID
  --help       Show this help message

Environment variables required:
  ANTHROPIC_API_KEY    Anthropic API key for Claude

Examples:
  npx tsx src/cli/categorize-articles.ts --dry-run
  npx tsx src/cli/categorize-articles.ts --id abc123
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
    console.log("DRY RUN MODE - categories will not be saved\n");
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
    articles = allArticles.filter(
      (a) => a.categories.length === 0,
    );
  }

  if (articles.length === 0) {
    console.log("No uncategorized articles found.");
    closeDatabase();
    return;
  }

  console.log(`Found ${articles.length} article(s) to categorize:\n`);

  let categorized = 0;

  for (const article of articles) {
    console.log(
      `Categorizing: ${article.title.slice(0, 60)}${article.title.length > 60 ? "..." : ""}`,
    );

    try {
      const categories = await categorizeArticle(
        article.rawContent,
        article.title,
      );

      console.log(`  Categories: ${categories.join(", ")}\n`);

      if (!dryRun) {
        updateArticleCategories(article.id, categories);
        console.log("  Saved to database.\n");
      }

      categorized++;

      // Rate limiting: 500ms delay between API calls
      if (articles.indexOf(article) < articles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error categorizing: ${message}\n`);
    }
  }

  if (dryRun) {
    console.log(
      `\nDry run complete. Categorized ${categorized} article(s). Run without --dry-run to save.`,
    );
  } else {
    console.log(`\nCategorized and saved ${categorized} article(s).`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
