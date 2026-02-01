#!/usr/bin/env node
import {
  getArticleById,
  updateArticleStatus,
  getArticlesByStatus,
  type CurationStatus,
} from "../models/article.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/select-article.ts <id> <status> | --pending | --selected

Arguments:
  <id>        Article ID
  <status>    New status: pending, selected, rejected, published

Options:
  --pending   List all pending articles
  --selected  List all selected articles

Examples:
  npx tsx src/cli/select-article.ts abc123 selected
  npx tsx src/cli/select-article.ts abc123 rejected
  npx tsx src/cli/select-article.ts --pending
  npx tsx src/cli/select-article.ts --selected
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (args[0] === "--pending") {
    const articles = getArticlesByStatus("pending");
    if (articles.length === 0) {
      console.log("No pending articles.");
    } else {
      console.log(`\nPending articles (${articles.length}):\n`);
      for (const article of articles) {
        console.log(`ID: ${article.id}`);
        console.log(`Title: ${article.title}`);
        console.log(`Source: ${article.source}`);
        console.log(`Ingested: ${article.ingestedAt.toISOString()}`);
        console.log("---");
      }
    }
    closeDatabase();
    return;
  }

  if (args[0] === "--selected") {
    const articles = getArticlesByStatus("selected");
    if (articles.length === 0) {
      console.log("No selected articles.");
    } else {
      console.log(`\nSelected articles (${articles.length}):\n`);
      for (const article of articles) {
        console.log(`ID: ${article.id}`);
        console.log(`Title: ${article.title}`);
        console.log(`Source: ${article.source}`);
        console.log("---");
      }
    }
    closeDatabase();
    return;
  }

  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const [id, status] = args;

  const validStatuses: CurationStatus[] = ["pending", "selected", "rejected", "published"];
  if (!validStatuses.includes(status as CurationStatus)) {
    console.error(`Error: Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    process.exit(1);
  }

  const article = getArticleById(id);
  if (!article) {
    console.error(`Error: Article not found with ID: ${id}`);
    process.exit(1);
  }

  const updated = updateArticleStatus(id, status as CurationStatus);

  console.log(`\nArticle status updated!`);
  console.log(`Title: ${updated!.title}`);
  console.log(`Old status: ${article.curationStatus}`);
  console.log(`New status: ${updated!.curationStatus}`);

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
