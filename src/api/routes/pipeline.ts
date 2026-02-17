import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pollRssFeeds } from "../../services/ingestion/rss-poller.js";
import { pollEmails, identifySource } from "../../services/ingestion/email-poller.js";
import { extractArticles } from "../../services/ingestion/article-extractor.js";
import { summarizeArticle } from "../../services/processing/summarizer.js";
import { categorizeArticle } from "../../services/processing/categorizer.js";
import { enrichArticle } from "../../services/processing/enricher.js";
import { detectTrending } from "../../services/trending/hn-trending.js";
import { composeNewsletter } from "../../services/newsletter/composer.js";
import {
  createArticle,
  findArticleByUrl,
  getAllArticles,
  getArticlesByStatus,
  getArticlesByIds,
  getUnenrichedArticles,
  getTopScoredArticles,
  updateArticleSummary,
  updateArticleCategories,
  updateArticleEnrichment,
  updateArticleStatus,
} from "../../models/article.js";
import { getActiveSubscribers } from "../../models/subscriber.js";
import { createNewsletterIssue, markIssueSent } from "../../models/newsletter-issue.js";
import { sendNewsletterToAll, sendComposedNewsletterToAll } from "../../services/newsletter/sender.js";

export const pipelineRouter = Router();
pipelineRouter.use(requireAuth);

pipelineRouter.post("/poll-rss", async (_req, res) => {
  try {
    const rssArticles = await pollRssFeeds();
    let stored = 0;
    let skipped = 0;

    for (const article of rssArticles) {
      if (article.url && findArticleByUrl(article.url)) {
        skipped++;
        continue;
      }
      createArticle({
        source: article.source,
        sourceType: "rss",
        title: article.title,
        originalUrl: article.url,
        rawContent: article.content,
        publishedAt: article.publishedAt,
      });
      stored++;
    }

    res.json({ found: rssArticles.length, stored, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

pipelineRouter.post("/poll-emails", async (_req, res) => {
  try {
    const newsletters = await pollEmails({ markAsRead: true });
    let totalArticles = 0;

    for (const newsletter of newsletters) {
      const source = identifySource(newsletter.from);
      const extracted = extractArticles(newsletter.html || newsletter.text, source);

      for (const article of extracted) {
        if (article.url && findArticleByUrl(article.url)) {
          continue;
        }
        createArticle({
          source,
          sourceType: "email",
          title: article.title,
          originalUrl: article.url,
          rawContent: article.content,
          publishedAt: newsletter.date,
        });
        totalArticles++;
      }
    }

    res.json({ newsletters: newsletters.length, articles: totalArticles });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Legacy: summarize only (kept for backwards compatibility)
pipelineRouter.post("/summarize", async (_req, res) => {
  try {
    const articles = getAllArticles().filter((a) => !a.summary);

    if (articles.length === 0) {
      res.json({ summarized: 0, message: "No articles need summarization" });
      return;
    }

    let summarized = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const summary = await summarizeArticle(article.rawContent, article.title);
        updateArticleSummary(article.id, summary);
        summarized++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        errors.push(`${article.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ found: articles.length, summarized, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Legacy: categorize only (kept for backwards compatibility)
pipelineRouter.post("/categorize", async (_req, res) => {
  try {
    const articles = getAllArticles().filter((a) => a.categories.length === 0);

    if (articles.length === 0) {
      res.json({ categorized: 0, message: "No articles need categorization" });
      return;
    }

    let categorized = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const categories = await categorizeArticle(article.rawContent, article.title);
        updateArticleCategories(article.id, categories);
        categorized++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        errors.push(`${article.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ found: articles.length, categorized, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// New: unified enrichment (summary + categories + score + actionable in one LLM call)
pipelineRouter.post("/enrich", async (_req, res) => {
  try {
    const articles = getUnenrichedArticles();

    if (articles.length === 0) {
      res.json({ enriched: 0, message: "No articles need enrichment" });
      return;
    }

    let enriched = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const result = await enrichArticle(article.rawContent, article.title, article.source);
        updateArticleEnrichment(article.id, result);
        enriched++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        errors.push(`${article.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ found: articles.length, enriched, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// New: compose a newsletter plan from enriched articles
pipelineRouter.post("/compose", async (_req, res) => {
  try {
    const articles = getTopScoredArticles(20);

    if (articles.length === 0) {
      res.status(400).json({ error: "No enriched articles available. Run /enrich first." });
      return;
    }

    // Detect trending
    const trendingMatches = await detectTrending(articles);

    // Compose the newsletter plan
    const plan = await composeNewsletter(articles, trendingMatches);

    res.json({
      totalArticles: plan.totalCount,
      topStory: plan.topStory ? {
        title: plan.topStory.article.title,
        score: plan.topStory.article.relevanceScore,
        intro: plan.topStoryIntro,
      } : null,
      tryThis: plan.tryThis ? {
        title: plan.tryThis.article.title,
        score: plan.tryThis.article.relevanceScore,
      } : null,
      trending: trendingMatches.length,
      articles: plan.articles.map((c) => ({
        rank: c.rank,
        title: c.article.title,
        score: c.article.relevanceScore,
        tags: c.tags,
        isTopStory: c.isTopStory,
        isTryThis: c.isTryThis,
        isTrending: c.isTrending,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Legacy: send newsletter (flat article list)
pipelineRouter.post("/send-newsletter", async (req, res) => {
  try {
    const { title, articleIds } = req.body as { title?: string; articleIds?: string[] };

    if (!title) {
      res.status(400).json({ error: "title is required in request body" });
      return;
    }

    const articles = articleIds
      ? getArticlesByIds(articleIds)
      : getArticlesByStatus("selected");

    if (articles.length === 0) {
      res.status(400).json({ error: "No articles found. Select articles first or provide articleIds." });
      return;
    }

    const subscribers = getActiveSubscribers();
    if (subscribers.length === 0) {
      res.status(400).json({ error: "No active subscribers found." });
      return;
    }

    const issue = createNewsletterIssue({
      title,
      articleIds: articles.map((a) => a.id),
    });

    const result = await sendNewsletterToAll(issue, articles, subscribers);

    if (result.successCount > 0) {
      markIssueSent(issue.id);
      for (const article of articles) {
        updateArticleStatus(article.id, "published");
      }
    }

    res.json({
      issueNumber: issue.issueNumber,
      title: issue.title,
      articles: articles.length,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// New: send composed newsletter (with top story, try this, ranked list)
pipelineRouter.post("/send-composed", async (req, res) => {
  try {
    const { title } = req.body as { title?: string };

    if (!title) {
      res.status(400).json({ error: "title is required in request body" });
      return;
    }

    const articles = getTopScoredArticles(15);
    if (articles.length === 0) {
      res.status(400).json({ error: "No enriched articles available. Run /enrich first." });
      return;
    }

    const subscribers = getActiveSubscribers();
    if (subscribers.length === 0) {
      res.status(400).json({ error: "No active subscribers found." });
      return;
    }

    // Detect trending + compose
    const trendingMatches = await detectTrending(articles);
    const plan = await composeNewsletter(articles, trendingMatches);

    // Create issue
    const issue = createNewsletterIssue({
      title,
      articleIds: plan.articles.map((c) => c.article.id),
    });

    // Send
    const result = await sendComposedNewsletterToAll(issue, plan, subscribers);

    if (result.successCount > 0) {
      markIssueSent(issue.id);
      for (const composed of plan.articles) {
        updateArticleStatus(composed.article.id, "published");
      }
    }

    res.json({
      issueNumber: issue.issueNumber,
      title: issue.title,
      articles: plan.totalCount,
      topStory: plan.topStory?.article.title ?? null,
      tryThis: plan.tryThis?.article.title ?? null,
      trending: trendingMatches.length,
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Updated run-all: uses enricher instead of separate summarize/categorize
pipelineRouter.post("/run-all", async (_req, res) => {
  const results: Record<string, unknown> = {};

  try {
    // 1. Poll RSS
    const rssArticles = await pollRssFeeds();
    let rssStored = 0;
    for (const article of rssArticles) {
      if (article.url && findArticleByUrl(article.url)) continue;
      createArticle({
        source: article.source,
        sourceType: "rss",
        title: article.title,
        originalUrl: article.url,
        rawContent: article.content,
        publishedAt: article.publishedAt,
      });
      rssStored++;
    }
    results.rss = { found: rssArticles.length, stored: rssStored };

    // 2. Poll emails (skip if no credentials)
    if (process.env.GMAIL_APP_PASSWORD) {
      try {
        const newsletters = await pollEmails({ markAsRead: true });
        let emailArticles = 0;
        for (const newsletter of newsletters) {
          const source = identifySource(newsletter.from);
          const extracted = extractArticles(newsletter.html || newsletter.text, source);
          for (const article of extracted) {
            if (article.url && findArticleByUrl(article.url)) continue;
            createArticle({
              source,
              sourceType: "email",
              title: article.title,
              originalUrl: article.url,
              rawContent: article.content,
              publishedAt: newsletter.date,
            });
            emailArticles++;
          }
        }
        results.email = { newsletters: newsletters.length, articles: emailArticles };
      } catch (err) {
        results.email = { error: err instanceof Error ? err.message : String(err) };
      }
    } else {
      results.email = { skipped: "GMAIL_APP_PASSWORD not set" };
    }

    // 3. Enrich (unified: summary + categories + score + actionable)
    if (process.env.CLAUDE_API_KEY) {
      const unenriched = getUnenrichedArticles();
      let enriched = 0;
      for (const article of unenriched) {
        try {
          const enrichment = await enrichArticle(article.rawContent, article.title, article.source);
          updateArticleEnrichment(article.id, enrichment);
          enriched++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          // continue on individual failures
        }
      }
      results.enrich = { found: unenriched.length, enriched };
    } else {
      results.enrich = { skipped: "CLAUDE_API_KEY not set" };
    }

    // 4. Detect trending
    try {
      const topArticles = getTopScoredArticles(20);
      const trending = await detectTrending(topArticles);
      results.trending = { checked: topArticles.length, matches: trending.length };
    } catch {
      results.trending = { error: "HN trending detection failed" };
    }

    res.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message, partialResults: results });
  }
});
