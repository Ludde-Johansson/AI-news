import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/index.js";

export type SourceType = "email" | "rss" | "manual";
export type CurationStatus = "pending" | "selected" | "rejected" | "published";

export interface Article {
  id: string;
  source: string;
  sourceType: SourceType;
  originalUrl: string | null;
  title: string;
  rawContent: string;
  summary: string | null;
  categories: string[];
  curationStatus: CurationStatus;
  relevanceScore: number | null;
  isActionable: boolean;
  publishedAt: Date | null;
  ingestedAt: Date;
}

interface ArticleRow {
  id: string;
  source: string;
  source_type: string;
  original_url: string | null;
  title: string;
  raw_content: string;
  summary: string | null;
  categories: string;
  curation_status: string;
  relevance_score: number | null;
  is_actionable: number;
  published_at: string | null;
  ingested_at: string;
}

function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    source: row.source,
    sourceType: row.source_type as SourceType,
    originalUrl: row.original_url,
    title: row.title,
    rawContent: row.raw_content,
    summary: row.summary,
    categories: JSON.parse(row.categories),
    curationStatus: row.curation_status as CurationStatus,
    relevanceScore: row.relevance_score ?? null,
    isActionable: row.is_actionable === 1,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    ingestedAt: new Date(row.ingested_at),
  };
}

export interface CreateArticleInput {
  source: string;
  sourceType: SourceType;
  originalUrl?: string;
  title: string;
  rawContent: string;
  summary?: string;
  categories?: string[];
  publishedAt?: Date;
}

export function createArticle(input: CreateArticleInput): Article {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO articles (id, source, source_type, original_url, title, raw_content, summary, categories, published_at, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.source,
    input.sourceType,
    input.originalUrl || null,
    input.title,
    input.rawContent,
    input.summary || null,
    JSON.stringify(input.categories || []),
    input.publishedAt?.toISOString() || null,
    now
  );

  return getArticleById(id)!;
}

export function getArticleById(id: string): Article | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM articles WHERE id = ?");
  const row = stmt.get(id) as ArticleRow | undefined;
  return row ? rowToArticle(row) : null;
}

export function getArticlesByStatus(status: CurationStatus): Article[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM articles WHERE curation_status = ? ORDER BY ingested_at DESC"
  );
  const rows = stmt.all(status) as ArticleRow[];
  return rows.map(rowToArticle);
}

export function getArticlesByIds(ids: string[]): Article[] {
  if (ids.length === 0) return [];
  const db = getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  const stmt = db.prepare(`SELECT * FROM articles WHERE id IN (${placeholders})`);
  const rows = stmt.all(...ids) as ArticleRow[];
  return rows.map(rowToArticle);
}

export function updateArticleStatus(id: string, status: CurationStatus): Article | null {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE articles SET curation_status = ? WHERE id = ?");
  stmt.run(status, id);
  return getArticleById(id);
}

export function updateArticleSummary(id: string, summary: string): Article | null {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE articles SET summary = ? WHERE id = ?");
  stmt.run(summary, id);
  return getArticleById(id);
}

export function getAllArticles(): Article[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM articles ORDER BY ingested_at DESC");
  const rows = stmt.all() as ArticleRow[];
  return rows.map(rowToArticle);
}

export function findArticleByUrl(url: string): Article | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM articles WHERE original_url = ?");
  const row = stmt.get(url) as ArticleRow | undefined;
  return row ? rowToArticle(row) : null;
}

export function updateArticleCategories(
  id: string,
  categories: string[],
): Article | null {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE articles SET categories = ? WHERE id = ?");
  stmt.run(JSON.stringify(categories), id);
  return getArticleById(id);
}

export function updateArticleEnrichment(
  id: string,
  data: {
    summary: string;
    categories: string[];
    relevanceScore: number;
    isActionable: boolean;
  },
): Article | null {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE articles SET summary = ?, categories = ?, relevance_score = ?, is_actionable = ? WHERE id = ?"
  );
  stmt.run(
    data.summary,
    JSON.stringify(data.categories),
    data.relevanceScore,
    data.isActionable ? 1 : 0,
    id
  );
  return getArticleById(id);
}

export function getUnenrichedArticles(): Article[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM articles WHERE relevance_score IS NULL ORDER BY ingested_at DESC"
  );
  const rows = stmt.all() as ArticleRow[];
  return rows.map(rowToArticle);
}

export function getTopScoredArticles(limit: number = 20): Article[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM articles WHERE relevance_score IS NOT NULL AND curation_status IN ('pending', 'selected') ORDER BY relevance_score DESC, ingested_at DESC LIMIT ?"
  );
  const rows = stmt.all(limit) as ArticleRow[];
  return rows.map(rowToArticle);
}
