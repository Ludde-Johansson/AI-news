import { app } from "../app.js";
import { closeDatabase } from "../db/index.js";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

let server: http.Server | null = null;
let baseUrl = "";
let tempDbPath = "";

export function getBaseUrl(): string {
  return baseUrl;
}

export async function startTestServer(): Promise<string> {
  // Use a temp database so tests don't pollute real data
  tempDbPath = path.join(os.tmpdir(), `ai-news-test-${Date.now()}.db`);
  process.env.DATABASE_PATH = tempDbPath;
  process.env.API_SECRET = "test-secret";

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      if (typeof addr === "object" && addr) {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve(baseUrl);
    });
  });
}

export async function stopTestServer(): Promise<void> {
  closeDatabase();

  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }

  // Clean up temp database files
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = tempDbPath + suffix;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

export function authHeader(): Record<string, string> {
  return { Authorization: "Bearer test-secret" };
}
