import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pollRssFeeds } from "../../services/ingestion/rss-poller.js";
import { pollEmails, identifySource } from "../../services/ingestion/email-poller.js";
import { extractArticles } from "../../services/ingestion/article-extractor.js";
import { summarizeArticle } from "../../services/processing/summarizer.js";
import { categorizeArticle } from "../../services/processing/categorizer.js";
import {
  createArticle,
  findArticleByUrl,
  getAllArticles,
  getArticlesByStatus,
  getArticlesByIds,
  updateArticleSummary,
  updateArticleCategories,
  updateArticleStatus,
} from "../../models/article.js";
import { getActiveSubscribers } from "../../models/subscriber.js";
import { createNewsletterIssue, markIssueSent } from "../../models/newsletter-issue.js";
import { sendNewsletterToAll } from "../../services/newsletter/sender.js";

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

pipelineRouter.post("/run-all", async (req, res) => {
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

    // 3. Summarize
    if (process.env.CLAUDE_API_KEY) {
      const unsummarized = getAllArticles().filter((a) => !a.summary);
      let summarized = 0;
      for (const article of unsummarized) {
        try {
          const summary = await summarizeArticle(article.rawContent, article.title);
          updateArticleSummary(article.id, summary);
          summarized++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          // continue on individual failures
        }
      }
      results.summarize = { found: unsummarized.length, summarized };
    } else {
      results.summarize = { skipped: "CLAUDE_API_KEY not set" };
    }

    // 4. Categorize
    if (process.env.CLAUDE_API_KEY) {
      const uncategorized = getAllArticles().filter((a) => a.categories.length === 0);
      let categorized = 0;
      for (const article of uncategorized) {
        try {
          const categories = await categorizeArticle(article.rawContent, article.title);
          updateArticleCategories(article.id, categories);
          categorized++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          // continue on individual failures
        }
      }
      results.categorize = { found: uncategorized.length, categorized };
    } else {
      results.categorize = { skipped: "CLAUDE_API_KEY not set" };
    }

    res.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message, partialResults: results });
  }
});
