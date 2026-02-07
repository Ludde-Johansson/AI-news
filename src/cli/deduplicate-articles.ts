#!/usr/bin/env node
import { findAllDuplicates } from "../services/ingestion/deduplicator.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/deduplicate-articles.ts [options]

Options:
  --help       Show this help message

Scans all articles and reports duplicate groups (by URL and by title).
This is a read-only operation - no articles are deleted.

Examples:
  npx tsx src/cli/deduplicate-articles.ts
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  console.log("Scanning for duplicate articles...\n");

  const groups = findAllDuplicates();

  if (groups.length === 0) {
    console.log("No duplicates found.");
    closeDatabase();
    return;
  }

  console.log(`Found ${groups.length} duplicate group(s):\n`);

  for (const group of groups) {
    console.log(`[${group.type.toUpperCase()}] ${group.key}`);
    for (const article of group.articles) {
      console.log(`  - [${article.id.slice(0, 8)}] ${article.title.slice(0, 60)}`);
      console.log(`    Source: ${article.source} | Ingested: ${article.ingestedAt.toISOString()}`);
    }
    console.log("---");
  }

  console.log(`\nTotal: ${groups.length} duplicate group(s). No articles were modified.`);

  closeDatabase();
}

main();
