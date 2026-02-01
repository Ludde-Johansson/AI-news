#!/usr/bin/env node
import { createSubscriber, getAllSubscribers, getSubscriberByEmail } from "../models/subscriber.js";
import { closeDatabase } from "../db/index.js";

function printUsage(): void {
  console.log(`
Usage: npx tsx src/cli/add-subscriber.ts <email> | --list

Arguments:
  <email>     Email address to subscribe

Options:
  --list      List all subscribers

Examples:
  npx tsx src/cli/add-subscriber.ts john@example.com
  npx tsx src/cli/add-subscriber.ts --list
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (args[0] === "--list") {
    const subscribers = getAllSubscribers();
    if (subscribers.length === 0) {
      console.log("No subscribers found.");
    } else {
      console.log(`\nFound ${subscribers.length} subscriber(s):\n`);
      for (const sub of subscribers) {
        console.log(`ID: ${sub.id}`);
        console.log(`Email: ${sub.email}`);
        console.log(`Status: ${sub.status}`);
        console.log(`Subscribed: ${sub.subscribedAt.toISOString()}`);
        console.log(`Unsubscribe Token: ${sub.unsubscribeToken}`);
        console.log("---");
      }
    }
    closeDatabase();
    return;
  }

  const email = args[0];

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email format");
    process.exit(1);
  }

  // Check if already exists
  const existing = getSubscriberByEmail(email);
  if (existing) {
    console.log(`\nSubscriber already exists:`);
    console.log(`ID: ${existing.id}`);
    console.log(`Email: ${existing.email}`);
    console.log(`Status: ${existing.status}`);
    closeDatabase();
    return;
  }

  const subscriber = createSubscriber(email);

  console.log(`\nSubscriber added successfully!`);
  console.log(`ID: ${subscriber.id}`);
  console.log(`Email: ${subscriber.email}`);
  console.log(`Status: ${subscriber.status}`);
  console.log(`Unsubscribe Token: ${subscriber.unsubscribeToken}`);

  closeDatabase();
}

main().catch((error) => {
  console.error("Error:", error.message);
  closeDatabase();
  process.exit(1);
});
