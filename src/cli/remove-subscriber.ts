#!/usr/bin/env node
import { getDatabase, closeDatabase } from "../db/index.js";

const email = process.argv[2];

if (!email) {
  console.log("Usage: npx tsx src/cli/remove-subscriber.ts <email>");
  process.exit(1);
}

const db = getDatabase();
const stmt = db.prepare("DELETE FROM subscribers WHERE email = ?");
const result = stmt.run(email.toLowerCase().trim());

if (result.changes > 0) {
  console.log(`Removed subscriber: ${email}`);
} else {
  console.log(`No subscriber found with email: ${email}`);
}

closeDatabase();
