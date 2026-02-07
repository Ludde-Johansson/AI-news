#!/usr/bin/env node
import { pollEmails, identifySource } from "../services/ingestion/email-poller.js";
import { extractArticles } from "../services/ingestion/article-extractor.js";
import { createArticle } from "../models/article.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/poll-emails.ts [options]

Options:
  --dry-run    Fetch emails but don't store them
  --help       Show this help message

Environment variables required:
  GMAIL_APP_PASSWORD    Gmail App Password (create at Google Account > Security > App passwords)

Examples:
  npx tsx src/cli/poll-emails.ts --dry-run
  GMAIL_APP_PASSWORD=xxxx npx tsx src/cli/poll-emails.ts
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of args) {
    if (arg === "--dry-run") {
      result.dryRun = "true";
    }
    if (arg === "--help") {
      result.help = "true";
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
    console.log("DRY RUN MODE - emails will not be stored\n");
  }

  console.log("Polling emails from Gmail...\n");

  const newsletters = await pollEmails();

  if (newsletters.length === 0) {
    console.log("No new newsletters found.");
    closeDatabase();
    return;
  }

  console.log(`\nFound ${newsletters.length} newsletter(s):\n`);

  let totalArticles = 0;

  for (const newsletter of newsletters) {
    const source = identifySource(newsletter.from);
    const extracted = extractArticles(newsletter.html || newsletter.text, source);

    console.log(`Newsletter: ${newsletter.subject}`);
    console.log(`Source: ${source}`);
    console.log(`Extracted ${extracted.length} article(s):`);

    for (const article of extracted) {
      console.log(`  - ${article.title.slice(0, 60)}${article.title.length > 60 ? "..." : ""}`);

      if (!dryRun) {
        const stored = createArticle({
          source,
          sourceType: "email",
          title: article.title,
          originalUrl: article.url,
          rawContent: article.content,
          publishedAt: newsletter.date,
        });
        console.log(`    Stored: ${stored.id}`);
        totalArticles++;
      }
    }
    console.log("---");
  }

  if (dryRun) {
    console.log("\nDry run complete. Run without --dry-run to store articles.");
  } else {
    console.log(`\nStored ${totalArticles} article(s) from ${newsletters.length} newsletter(s).`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
