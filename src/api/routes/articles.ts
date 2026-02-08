import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getAllArticles,
  getArticlesByStatus,
  getArticleById,
  updateArticleStatus,
  type CurationStatus,
} from "../../models/article.js";

export const articlesRouter = Router();
articlesRouter.use(requireAuth);

const VALID_STATUSES: CurationStatus[] = ["pending", "selected", "rejected", "published"];

articlesRouter.get("/", (req, res) => {
  try {
    const status = req.query.status as string | undefined;

    if (status) {
      if (!VALID_STATUSES.includes(status as CurationStatus)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        });
        return;
      }
      const articles = getArticlesByStatus(status as CurationStatus);
      res.json({ count: articles.length, articles });
      return;
    }

    const articles = getAllArticles();
    res.json({ count: articles.length, articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

articlesRouter.get("/:id", (req, res) => {
  try {
    const article = getArticleById(req.params.id);
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

articlesRouter.post("/:id/status", (req, res) => {
  try {
    const { status } = req.body as { status?: string };

    if (!status || !VALID_STATUSES.includes(status as CurationStatus)) {
      res.status(400).json({
        error: `status is required and must be one of: ${VALID_STATUSES.join(", ")}`,
      });
      return;
    }

    const article = updateArticleStatus(req.params.id, status as CurationStatus);
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});
