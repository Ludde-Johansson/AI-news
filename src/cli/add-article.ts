#!/usr/bin/env node
import { createArticle, getAllArticles } from "../models/article.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/add-article.ts [options]

Options:
  --title <title>       Article title (required)
  --source <source>     Source name, e.g., "The Batch" (required)
  --url <url>           Original article URL (optional)
  --content <content>   Article content (required)
  --summary <summary>   Article summary (optional)
  --categories <cats>   Comma-separated categories (optional)
  --list                List all articles

Examples:
  npx tsx src/cli/add-article.ts --title "New AI Model" --source "OpenAI Blog" --content "OpenAI announced..."
  npx tsx src/cli/add-article.ts --list
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (key === "list") {
        result[key] = "true";
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      }
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    const articles = getAllArticles();
    if (articles.length === 0) {
      console.log("No articles found.");
    } else {
      console.log(`\nFound ${articles.length} article(s):\n`);
      for (const article of articles) {
        console.log(`ID: ${article.id}`);
        console.log(`Title: ${article.title}`);
        console.log(`Source: ${article.source} (${article.sourceType})`);
        console.log(`Status: ${article.curationStatus}`);
        console.log(`Categories: ${article.categories.join(", ") || "none"}`);
        console.log(`Ingested: ${article.ingestedAt.toISOString()}`);
        console.log("---");
      }
    }
    closeDatabase();
    return;
  }

  if (!args.title || !args.source || !args.content) {
    printUsage();
    process.exit(1);
  }

  const categories = args.categories ? args.categories.split(",").map((c) => c.trim()) : [];

  const article = createArticle({
    title: args.title,
    source: args.source,
    sourceType: "manual",
    originalUrl: args.url,
    rawContent: args.content,
    summary: args.summary,
    categories,
  });

  console.log(`\nArticle created successfully!`);
  console.log(`ID: ${article.id}`);
  console.log(`Title: ${article.title}`);
  console.log(`Source: ${article.source}`);

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
