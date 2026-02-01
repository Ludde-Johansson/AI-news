#!/usr/bin/env node
import "../config.js"; // Load .env
import { getArticlesByStatus, getArticlesByIds, updateArticleStatus } from "../models/article.js";
import { getActiveSubscribers } from "../models/subscriber.js";
import { createNewsletterIssue, markIssueSent, getAllIssues } from "../models/newsletter-issue.js";
import { sendNewsletterToAll } from "../services/newsletter/sender.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/send-newsletter.ts [options]

Options:
  --title <title>       Newsletter title (required for new issue)
  --articles <ids>      Comma-separated article IDs to include (optional, uses 'selected' articles if not specified)
  --dry-run             Preview without sending
  --list                List all newsletter issues

Environment:
  RESEND_API_KEY        Required for sending emails
  BASE_URL              Base URL for unsubscribe links (default: http://localhost:3000)

Examples:
  npx tsx src/cli/send-newsletter.ts --title "This Week in AI" --dry-run
  npx tsx src/cli/send-newsletter.ts --title "AI Breakthroughs"
  npx tsx src/cli/send-newsletter.ts --list
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (key === "dry-run" || key === "list") {
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
    const issues = getAllIssues();
    if (issues.length === 0) {
      console.log("No newsletter issues found.");
    } else {
      console.log(`\nFound ${issues.length} issue(s):\n`);
      for (const issue of issues) {
        console.log(`Issue #${issue.issueNumber}: ${issue.title}`);
        console.log(`Status: ${issue.status}`);
        console.log(`Articles: ${issue.articleIds.length}`);
        console.log(`Created: ${issue.createdAt.toISOString()}`);
        if (issue.sentAt) {
          console.log(`Sent: ${issue.sentAt.toISOString()}`);
        }
        console.log("---");
      }
    }
    closeDatabase();
    return;
  }

  if (!args.title) {
    printUsage();
    process.exit(1);
  }

  const isDryRun = args["dry-run"] === "true";

  // Get articles
  let articles;
  if (args.articles) {
    const ids = args.articles.split(",").map((id) => id.trim());
    articles = getArticlesByIds(ids);
  } else {
    // Use articles with 'selected' status
    articles = getArticlesByStatus("selected");
  }

  if (articles.length === 0) {
    console.error(
      "\nError: No articles found. Add articles with 'selected' status or specify --articles"
    );
    console.log("\nTo select articles, first add them:");
    console.log('  npx tsx src/cli/add-article.ts --title "..." --source "..." --content "..."');
    closeDatabase();
    process.exit(1);
  }

  // Get active subscribers
  const subscribers = getActiveSubscribers();

  if (subscribers.length === 0) {
    console.error("\nError: No active subscribers found.");
    console.log("\nTo add subscribers:");
    console.log("  npx tsx src/cli/add-subscriber.ts email@example.com");
    closeDatabase();
    process.exit(1);
  }

  console.log(`\n=== Newsletter Preview ===`);
  console.log(`Title: ${args.title}`);
  console.log(`Articles: ${articles.length}`);
  for (const article of articles) {
    console.log(`  - ${article.title} (${article.source})`);
  }
  console.log(`\nSubscribers: ${subscribers.length}`);
  for (const sub of subscribers) {
    console.log(`  - ${sub.email}`);
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] Newsletter would be sent to ${subscribers.length} subscriber(s)`);
    closeDatabase();
    return;
  }

  // Check for API key
  if (!process.env.RESEND_API_KEY) {
    console.error("\nError: RESEND_API_KEY environment variable is not set");
    console.log("\nSet it with:");
    console.log("  $env:RESEND_API_KEY='re_xxx' (PowerShell)");
    console.log("  export RESEND_API_KEY=re_xxx (Bash)");
    closeDatabase();
    process.exit(1);
  }

  // Create the issue
  const issue = createNewsletterIssue({
    title: args.title,
    articleIds: articles.map((a) => a.id),
  });

  console.log(`\nCreated Issue #${issue.issueNumber}`);
  console.log("Sending emails...\n");

  // Send to all subscribers
  const result = await sendNewsletterToAll(issue, articles, subscribers);

  // Report results
  for (const sendResult of result.results) {
    if (sendResult.success) {
      console.log(`  [OK] ${sendResult.subscriber.email} (${sendResult.messageId})`);
    } else {
      console.log(`  [FAIL] ${sendResult.subscriber.email}: ${sendResult.error}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Sent: ${result.successCount}`);
  console.log(`Failed: ${result.failureCount}`);

  // Mark issue as sent if at least one succeeded
  if (result.successCount > 0) {
    markIssueSent(issue.id);

    // Mark articles as published
    for (const article of articles) {
      updateArticleStatus(article.id, "published");
    }

    console.log(`\nIssue #${issue.issueNumber} marked as sent.`);
  }

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
