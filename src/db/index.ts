import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initializeSchema } from "./schema.js";

const DEFAULT_DB_PATH = "./data/ai-news.db";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma("journal_mode = WAL");

  // Initialize schema
  initializeSchema(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
