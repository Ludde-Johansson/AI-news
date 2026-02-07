#!/usr/bin/env node
import { pollRssFeeds, RSS_FEEDS } from "../services/ingestion/rss-poller.js";
import { createArticle } from "../models/article.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/poll-rss.ts [options]

Options:
  --dry-run       Fetch RSS feeds but don't store articles
  --feed <name>   Only poll a specific feed (by source name)
  --list          List all configured RSS feeds
  --help          Show this help message

Examples:
  npx tsx src/cli/poll-rss.ts --list
  npx tsx src/cli/poll-rss.ts --dry-run
  npx tsx src/cli/poll-rss.ts --feed anthropic-blog
  npx tsx src/cli/poll-rss.ts
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
    if (args[i] === "--list") {
      result.list = "true";
    }
    if (args[i] === "--feed" && args[i + 1]) {
      result.feed = args[i + 1];
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

  if (args.list) {
    console.log("Configured RSS feeds:\n");
    for (const feed of RSS_FEEDS) {
      console.log(`  ${feed.source}`);
      console.log(`    Name: ${feed.name}`);
      console.log(`    URL:  ${feed.url}`);
      console.log("");
    }
    process.exit(0);
  }

  const dryRun = args.dryRun === "true";

  if (dryRun) {
    console.log("DRY RUN MODE - articles will not be stored\n");
  }

  let feeds = RSS_FEEDS;
  if (args.feed) {
    feeds = RSS_FEEDS.filter((f) => f.source === args.feed);
    if (feeds.length === 0) {
      console.error(`Unknown feed: ${args.feed}`);
      console.error(`Available feeds: ${RSS_FEEDS.map((f) => f.source).join(", ")}`);
      process.exit(1);
    }
  }

  console.log("Polling RSS feeds...\n");

  const articles = await pollRssFeeds(feeds);

  if (articles.length === 0) {
    console.log("No articles found.");
    closeDatabase();
    return;
  }

  console.log(`\nFound ${articles.length} article(s):\n`);

  let stored = 0;

  for (const article of articles) {
    console.log(`  [${article.source}] ${article.title}`);
    console.log(`    URL: ${article.url}`);

    if (!dryRun) {
      const created = createArticle({
        source: article.source,
        sourceType: "rss",
        title: article.title,
        originalUrl: article.url,
        rawContent: article.content,
        publishedAt: article.publishedAt,
      });
      console.log(`    Stored: ${created.id}`);
      stored++;
    }
  }

  if (dryRun) {
    console.log("\nDry run complete. Run without --dry-run to store articles.");
  } else {
    console.log(`\nStored ${stored} article(s).`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
