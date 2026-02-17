/**
 * Newsletter Composer
 *
 * Rule-based assembly of enriched articles into a newsletter plan.
 * Uses per-article scores to rank, flags for "Try This", and
 * a small batch LLM call to pick the top story + write an editorial intro.
 *
 * Architecture: Enriched per-article data + rule-based composer (Approach B)
 * Sections: Flat ranked list with inline tags (Option D)
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config.js";
import type { Article } from "../../models/article.js";
import type { TrendingMatch } from "../trending/hn-trending.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.CLAUDE_API_KEY) {
    throw new Error("CLAUDE_API_KEY is required.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  }
  return client;
}

export interface ComposedArticle {
  article: Article;
  rank: number;
  tags: string[];
  isTopStory: boolean;
  isTryThis: boolean;
  isTrending: boolean;
  hnScore?: number;
}

export interface NewsletterPlan {
  topStory: ComposedArticle | null;
  topStoryIntro: string | null;
  tryThis: ComposedArticle | null;
  articles: ComposedArticle[];
  totalCount: number;
}

/**
 * Category labels for display (short, human-readable tags).
 */
const TAG_LABELS: Record<string, string> = {
  llm: "LLM",
  safety: "Safety",
  research: "Research",
  tools: "Tools",
  policy: "Policy",
  business: "Business",
  "open-source": "Open Source",
  robotics: "Robotics",
  "computer-vision": "Vision",
  other: "Other",
};

function getTagLabels(categories: string[]): string[] {
  return categories.map((c) => TAG_LABELS[c] || c);
}

/**
 * Compose a newsletter from enriched articles.
 *
 * The flow:
 * 1. Sort articles by relevance_score DESC
 * 2. Mark trending articles (from HN matches)
 * 3. Pick "Try This" = highest-scored article with isActionable=true
 * 4. Use a small batch LLM call to pick the top story + write an intro
 * 5. Return the full ranked list with tags and badges
 */
export async function composeNewsletter(
  articles: Article[],
  trendingMatches: TrendingMatch[] = [],
  options: { maxArticles?: number; skipLlm?: boolean } = {},
): Promise<NewsletterPlan> {
  const maxArticles = options.maxArticles ?? 15;
  const trendingIds = new Set(trendingMatches.map((m) => m.articleId));
  const trendingScores = new Map(
    trendingMatches.map((m) => [m.articleId, m.hnScore]),
  );

  // Sort by score descending, then by ingestion date
  const sorted = [...articles]
    .filter((a) => a.relevanceScore !== null)
    .sort((a, b) => {
      const scoreDiff = (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return b.ingestedAt.getTime() - a.ingestedAt.getTime();
    })
    .slice(0, maxArticles);

  // Build composed articles
  const composed: ComposedArticle[] = sorted.map((article, index) => ({
    article,
    rank: index + 1,
    tags: getTagLabels(article.categories),
    isTopStory: false,
    isTryThis: false,
    isTrending: trendingIds.has(article.id),
    hnScore: trendingScores.get(article.id),
  }));

  // Pick "Try This" — highest-scored actionable article
  const tryThisCandidate = composed.find((c) => c.article.isActionable);
  if (tryThisCandidate) {
    tryThisCandidate.isTryThis = true;
  }

  // Pick top story + editorial intro via small batch LLM call
  let topStoryIntro: string | null = null;

  if (!options.skipLlm && composed.length > 0) {
    try {
      const result = await pickTopStory(composed.slice(0, 10));
      if (result) {
        const topMatch = composed.find(
          (c) => c.article.id === result.articleId,
        );
        if (topMatch) {
          topMatch.isTopStory = true;
          topStoryIntro = result.intro;
        }
      }
    } catch (error) {
      console.error(
        `Top story LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Fallback: if no top story was picked by LLM, use the #1 ranked article
  const topStory = composed.find((c) => c.isTopStory);
  if (!topStory && composed.length > 0) {
    composed[0].isTopStory = true;
  }

  return {
    topStory: composed.find((c) => c.isTopStory) ?? null,
    topStoryIntro,
    tryThis: tryThisCandidate ?? null,
    articles: composed,
    totalCount: composed.length,
  };
}

interface TopStoryPick {
  articleId: string;
  intro: string;
}

/**
 * Small batch LLM call: Given the top ~10 articles, pick THE top story
 * and write a 1-sentence editorial intro for it.
 *
 * This is the "B+" part — adds editorial judgment on top of per-article scores.
 */
async function pickTopStory(
  candidates: ComposedArticle[],
): Promise<TopStoryPick | null> {
  const anthropic = getClient();

  const articleList = candidates
    .map(
      (c) =>
        `[${c.article.id}] "${c.article.title}" (score: ${c.article.relevanceScore}, source: ${c.article.source})${c.isTrending ? " [TRENDING ON HN]" : ""}\nSummary: ${c.article.summary ?? "No summary"}`,
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: `You are the editor of an AI newsletter for developers. Pick the single most important/interesting article to lead the newsletter as the "Top Story". Consider: significance to the AI developer community, novelty, and timeliness. Trending articles deserve extra weight.

Respond with ONLY valid JSON:
{"article_id": "the-id-you-chose", "intro": "One compelling sentence that hooks the reader and explains why this matters."}`,
    messages: [
      {
        role: "user",
        content: `Here are today's top articles. Pick the lead story:\n\n${articleList}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const parsed = JSON.parse(text);
    const articleId =
      typeof parsed.article_id === "string" ? parsed.article_id : null;
    const intro = typeof parsed.intro === "string" ? parsed.intro : null;

    if (!articleId) return null;

    // Verify the article ID is in our candidates
    const valid = candidates.some((c) => c.article.id === articleId);
    if (!valid) return null;

    return { articleId, intro };
  } catch {
    return null;
  }
}
