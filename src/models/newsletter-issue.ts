import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/index.js";

export type IssueStatus = "draft" | "scheduled" | "sent";

export interface NewsletterIssue {
  id: string;
  issueNumber: number;
  title: string;
  articleIds: string[];
  status: IssueStatus;
  scheduledFor: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

interface IssueRow {
  id: string;
  issue_number: number;
  title: string;
  article_ids: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

function rowToIssue(row: IssueRow): NewsletterIssue {
  return {
    id: row.id,
    issueNumber: row.issue_number,
    title: row.title,
    articleIds: JSON.parse(row.article_ids),
    status: row.status as IssueStatus,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : null,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export interface CreateIssueInput {
  title: string;
  articleIds: string[];
}

export function createNewsletterIssue(input: CreateIssueInput): NewsletterIssue {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next issue number
  const maxStmt = db.prepare("SELECT MAX(issue_number) as max_num FROM newsletter_issues");
  const result = maxStmt.get() as { max_num: number | null };
  const issueNumber = (result.max_num || 0) + 1;

  const stmt = db.prepare(`
    INSERT INTO newsletter_issues (id, issue_number, title, article_ids, status, created_at)
    VALUES (?, ?, ?, ?, 'draft', ?)
  `);

  stmt.run(id, issueNumber, input.title, JSON.stringify(input.articleIds), now);

  return getIssueById(id)!;
}

export function getIssueById(id: string): NewsletterIssue | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM newsletter_issues WHERE id = ?");
  const row = stmt.get(id) as IssueRow | undefined;
  return row ? rowToIssue(row) : null;
}

export function getIssueByNumber(issueNumber: number): NewsletterIssue | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM newsletter_issues WHERE issue_number = ?");
  const row = stmt.get(issueNumber) as IssueRow | undefined;
  return row ? rowToIssue(row) : null;
}

export function getLatestIssue(): NewsletterIssue | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM newsletter_issues ORDER BY issue_number DESC LIMIT 1");
  const row = stmt.get() as IssueRow | undefined;
  return row ? rowToIssue(row) : null;
}

export function getDraftIssues(): NewsletterIssue[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM newsletter_issues WHERE status = 'draft' ORDER BY created_at DESC"
  );
  const rows = stmt.all() as IssueRow[];
  return rows.map(rowToIssue);
}

export function getAllIssues(): NewsletterIssue[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM newsletter_issues ORDER BY issue_number DESC");
  const rows = stmt.all() as IssueRow[];
  return rows.map(rowToIssue);
}

export function markIssueSent(id: string): NewsletterIssue | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare("UPDATE newsletter_issues SET status = 'sent', sent_at = ? WHERE id = ?");
  stmt.run(now, id);
  return getIssueById(id);
}

export function updateIssueArticles(id: string, articleIds: string[]): NewsletterIssue | null {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE newsletter_issues SET article_ids = ? WHERE id = ?");
  stmt.run(JSON.stringify(articleIds), id);
  return getIssueById(id);
}
