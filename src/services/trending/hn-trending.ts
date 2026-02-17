/**
 * Hacker News trending detection.
 *
 * Polls HN top stories and cross-references with our articles to detect
 * what's currently trending in the AI/tech community.
 *
 * HN API docs: https://github.com/HackerNewsAPI/API
 */

export interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
}

export interface TrendingMatch {
  articleId: string;
  articleTitle: string;
  hnStoryId: number;
  hnTitle: string;
  hnScore: number;
  hnUrl?: string;
}

/**
 * Fetch top stories from Hacker News.
 * Returns up to `limit` top stories with their metadata.
 */
export async function fetchHNTopStories(limit: number = 30): Promise<HNStory[]> {
  const topIdsRes = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );

  if (!topIdsRes.ok) {
    throw new Error(`HN API error: ${topIdsRes.status}`);
  }

  const topIds: number[] = await topIdsRes.json();
  const storyIds = topIds.slice(0, limit);

  const stories: HNStory[] = [];

  // Fetch story details in parallel (batches of 10)
  for (let i = 0; i < storyIds.length; i += 10) {
    const batch = storyIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          );
          if (!res.ok) return null;
          const item = await res.json();
          if (!item || item.type !== "story") return null;
          return {
            id: item.id,
            title: item.title || "",
            url: item.url,
            score: item.score || 0,
          } as HNStory;
        } catch {
          return null;
        }
      }),
    );

    for (const story of results) {
      if (story) stories.push(story);
    }
  }

  return stories;
}

/**
 * Normalize a string for fuzzy matching.
 * Lowercases, removes punctuation, collapses whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract significant keywords from a title (3+ chars, no stop words).
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "has", "have", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "this", "that", "these", "those",
    "it", "its", "not", "no", "new", "how", "what", "why", "when", "who",
    "which", "all", "just", "about", "into", "over", "your", "you", "more",
  ]);

  return normalize(title)
    .split(" ")
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

/**
 * Check if two titles are about the same topic.
 * Uses keyword overlap — if 40%+ of the shorter title's keywords
 * appear in the longer title, it's a match.
 */
function titlesMatch(titleA: string, titleB: string): boolean {
  const keywordsA = extractKeywords(titleA);
  const keywordsB = extractKeywords(titleB);

  if (keywordsA.length === 0 || keywordsB.length === 0) return false;

  const shorter = keywordsA.length <= keywordsB.length ? keywordsA : keywordsB;
  const longerSet = new Set(
    keywordsA.length <= keywordsB.length ? keywordsB : keywordsA,
  );

  const overlap = shorter.filter((w) => longerSet.has(w)).length;
  const threshold = Math.max(2, Math.ceil(shorter.length * 0.4));

  return overlap >= threshold;
}

/**
 * Cross-reference our articles with HN top stories.
 * Returns articles that match trending HN stories.
 */
export function findTrendingMatches(
  articles: Array<{ id: string; title: string }>,
  hnStories: HNStory[],
): TrendingMatch[] {
  const matches: TrendingMatch[] = [];
  const seen = new Set<string>();

  for (const article of articles) {
    for (const story of hnStories) {
      if (titlesMatch(article.title, story.title)) {
        if (!seen.has(article.id)) {
          matches.push({
            articleId: article.id,
            articleTitle: article.title,
            hnStoryId: story.id,
            hnTitle: story.title,
            hnScore: story.score,
            hnUrl: story.url,
          });
          seen.add(article.id);
        }
      }
    }
  }

  // Sort by HN score descending
  return matches.sort((a, b) => b.hnScore - a.hnScore);
}

/**
 * Full trending detection: fetch HN stories and match against articles.
 */
export async function detectTrending(
  articles: Array<{ id: string; title: string }>,
): Promise<TrendingMatch[]> {
  try {
    const hnStories = await fetchHNTopStories(30);
    return findTrendingMatches(articles, hnStories);
  } catch (error) {
    console.error(
      `HN trending detection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
