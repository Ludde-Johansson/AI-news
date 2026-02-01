import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/index.js";

export type SubscriberStatus = "pending" | "active" | "unsubscribed";

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  unsubscribeToken: string;
  subscribedAt: Date;
  confirmedAt: Date | null;
}

interface SubscriberRow {
  id: string;
  email: string;
  status: string;
  unsubscribe_token: string;
  subscribed_at: string;
  confirmed_at: string | null;
}

function rowToSubscriber(row: SubscriberRow): Subscriber {
  return {
    id: row.id,
    email: row.email,
    status: row.status as SubscriberStatus,
    unsubscribeToken: row.unsubscribe_token,
    subscribedAt: new Date(row.subscribed_at),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : null,
  };
}

export function createSubscriber(email: string): Subscriber {
  const db = getDatabase();
  const id = uuidv4();
  const unsubscribeToken = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO subscribers (id, email, status, unsubscribe_token, subscribed_at, confirmed_at)
    VALUES (?, ?, 'active', ?, ?, ?)
  `);

  // For Phase 1, we set subscribers directly to 'active' and confirmed
  stmt.run(id, email.toLowerCase().trim(), unsubscribeToken, now, now);

  return getSubscriberById(id)!;
}

export function getSubscriberById(id: string): Subscriber | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM subscribers WHERE id = ?");
  const row = stmt.get(id) as SubscriberRow | undefined;
  return row ? rowToSubscriber(row) : null;
}

export function getSubscriberByEmail(email: string): Subscriber | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM subscribers WHERE email = ?");
  const row = stmt.get(email.toLowerCase().trim()) as SubscriberRow | undefined;
  return row ? rowToSubscriber(row) : null;
}

export function getSubscriberByToken(token: string): Subscriber | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM subscribers WHERE unsubscribe_token = ?");
  const row = stmt.get(token) as SubscriberRow | undefined;
  return row ? rowToSubscriber(row) : null;
}

export function getActiveSubscribers(): Subscriber[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM subscribers WHERE status = 'active' ORDER BY subscribed_at"
  );
  const rows = stmt.all() as SubscriberRow[];
  return rows.map(rowToSubscriber);
}

export function getAllSubscribers(): Subscriber[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM subscribers ORDER BY subscribed_at");
  const rows = stmt.all() as SubscriberRow[];
  return rows.map(rowToSubscriber);
}

export function unsubscribe(token: string): Subscriber | null {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE subscribers SET status = 'unsubscribed' WHERE unsubscribe_token = ?"
  );
  stmt.run(token);
  return getSubscriberByToken(token);
}

export function confirmSubscriber(id: string): Subscriber | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE subscribers SET status = 'active', confirmed_at = ? WHERE id = ?"
  );
  stmt.run(now, id);
  return getSubscriberById(id);
}
