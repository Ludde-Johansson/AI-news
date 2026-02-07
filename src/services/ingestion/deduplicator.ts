import { getAllArticles, findArticleByUrl } from "../../models/article.js";
import type { Article } from "../../models/article.js";

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function findDuplicateByUrl(url: string): Article | null {
  if (!url) return null;
  return findArticleByUrl(url);
}

export function findDuplicateByTitle(title: string): Article | null {
  const normalized = normalizeTitle(title);
  const articles = getAllArticles();
  return articles.find((a) => normalizeTitle(a.title) === normalized) || null;
}

export function checkDuplicate(url: string, title: string): Article | null {
  if (url) {
    const byUrl = findDuplicateByUrl(url);
    if (byUrl) return byUrl;
  }
  return findDuplicateByTitle(title);
}

export interface DuplicateGroup {
  key: string;
  type: "url" | "title";
  articles: Article[];
}

export function findAllDuplicates(): DuplicateGroup[] {
  const articles = getAllArticles();
  const groups: DuplicateGroup[] = [];

  // Group by URL
  const byUrl = new Map<string, Article[]>();
  for (const article of articles) {
    if (!article.originalUrl) continue;
    const existing = byUrl.get(article.originalUrl) || [];
    existing.push(article);
    byUrl.set(article.originalUrl, existing);
  }
  for (const [url, arts] of byUrl) {
    if (arts.length > 1) {
      groups.push({ key: url, type: "url", articles: arts });
    }
  }

  // Group by normalized title
  const byTitle = new Map<string, Article[]>();
  for (const article of articles) {
    const normalized = normalizeTitle(article.title);
    if (!normalized) continue;
    const existing = byTitle.get(normalized) || [];
    existing.push(article);
    byTitle.set(normalized, existing);
  }
  for (const [title, arts] of byTitle) {
    if (arts.length > 1) {
      groups.push({ key: title, type: "title", articles: arts });
    }
  }

  return groups;
}
