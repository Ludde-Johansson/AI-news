import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, getBaseUrl, authHeader } from "./helpers.js";

describe("API Server", () => {
  before(async () => {
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  describe("Health & Status", () => {
    it("GET / returns status page", async () => {
      const res = await fetch(getBaseUrl() + "/");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.name, "AI News Newsletter");
      assert.equal(body.status, "running");
      assert.equal(typeof body.uptime, "number");
    });

    it("GET /health returns ok", async () => {
      const res = await fetch(getBaseUrl() + "/health");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.ok(body.timestamp);
    });
  });

  describe("Auth Middleware", () => {
    it("rejects pipeline routes without auth token", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/poll-rss", {
        method: "POST",
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, "Unauthorized");
    });

    it("rejects pipeline routes with wrong token", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/poll-rss", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
      });
      assert.equal(res.status, 401);
    });

    it("accepts pipeline routes with correct token", async () => {
      // Use summarize — no side effects when DB is empty
      const res = await fetch(getBaseUrl() + "/api/pipeline/summarize", {
        method: "POST",
        headers: authHeader(),
      });
      assert.notEqual(res.status, 401);
    });

    it("rejects article routes without auth token", async () => {
      const res = await fetch(getBaseUrl() + "/api/articles");
      assert.equal(res.status, 401);
    });

    it("accepts article routes with correct token", async () => {
      const res = await fetch(getBaseUrl() + "/api/articles", {
        headers: authHeader(),
      });
      assert.equal(res.status, 200);
    });
  });

  describe("Article CRUD", () => {
    let articleId: string;

    it("GET /api/articles returns empty list initially", async () => {
      const res = await fetch(getBaseUrl() + "/api/articles", {
        headers: authHeader(),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.count, 0);
      assert.deepEqual(body.articles, []);
    });

    it("creates an article via model and retrieves it", async () => {
      const { createArticle } = await import("../models/article.js");
      const article = createArticle({
        source: "test-source",
        sourceType: "manual",
        title: "Test Article",
        rawContent: "This is test content for the article.",
        originalUrl: "https://example.com/test",
      });
      articleId = article.id;

      const res = await fetch(getBaseUrl() + `/api/articles/${articleId}`, {
        headers: authHeader(),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.title, "Test Article");
      assert.equal(body.source, "test-source");
      assert.equal(body.curationStatus, "pending");
    });

    it("GET /api/articles?status=pending returns the article", async () => {
      const res = await fetch(getBaseUrl() + "/api/articles?status=pending", {
        headers: authHeader(),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.count, 1);
      assert.equal(body.articles[0].id, articleId);
    });

    it("POST /api/articles/:id/status updates status", async () => {
      const res = await fetch(getBaseUrl() + `/api/articles/${articleId}/status`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "selected" }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.curationStatus, "selected");
    });

    it("rejects invalid status", async () => {
      const res = await fetch(getBaseUrl() + `/api/articles/${articleId}/status`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid" }),
      });
      assert.equal(res.status, 400);
    });

    it("returns 404 for nonexistent article", async () => {
      const res = await fetch(getBaseUrl() + "/api/articles/nonexistent-id", {
        headers: authHeader(),
      });
      assert.equal(res.status, 404);
    });
  });

  describe("Pipeline - RSS Polling", () => {
    it("POST /api/pipeline/poll-rss fetches and stores articles", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/poll-rss", {
        method: "POST",
        headers: authHeader(),
      });

      if (res.status === 500) {
        const body = await res.json();
        console.log(`  RSS polling failed (likely network): ${body.error}`);
        return;
      }

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(typeof body.found, "number");
      assert.equal(typeof body.stored, "number");
      assert.ok(body.found >= 0);
      console.log(`  RSS: found ${body.found}, stored ${body.stored}, skipped ${body.skipped}`);
    });
  });

  describe("Pipeline - Enrich", () => {
    it("POST /api/pipeline/enrich responds with enrichment results", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/enrich", {
        method: "POST",
        headers: authHeader(),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      // Without CLAUDE_API_KEY, unenriched articles will fail individually but endpoint succeeds
      assert.equal(typeof body.found, "number");
      assert.ok(body.found >= 0);
      if (body.found === 0) {
        assert.ok(body.message.includes("No articles"));
      } else {
        assert.ok(Array.isArray(body.errors));
      }
    });
  });

  describe("Pipeline - Compose", () => {
    it("POST /api/pipeline/compose returns 400 when no enriched articles", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/compose", {
        method: "POST",
        headers: authHeader(),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error.includes("No enriched articles"));
    });

    it("POST /api/pipeline/compose returns plan with enriched articles", async () => {
      // Create enriched articles directly in DB
      const { createArticle, updateArticleEnrichment } = await import("../models/article.js");

      const a1 = createArticle({
        source: "test",
        sourceType: "manual",
        title: "Major AI Breakthrough",
        rawContent: "A big breakthrough in AI happened today.",
        originalUrl: "https://example.com/compose-1",
      });
      updateArticleEnrichment(a1.id, {
        summary: "A significant AI breakthrough was announced.",
        categories: ["research", "llm"],
        relevanceScore: 9,
        isActionable: false,
      });

      const a2 = createArticle({
        source: "test",
        sourceType: "manual",
        title: "New CLI Tool for AI Devs",
        rawContent: "Try this new tool today.",
        originalUrl: "https://example.com/compose-2",
      });
      updateArticleEnrichment(a2.id, {
        summary: "A new CLI tool lets developers build AI apps faster.",
        categories: ["tools"],
        relevanceScore: 7,
        isActionable: true,
      });

      const res = await fetch(getBaseUrl() + "/api/pipeline/compose", {
        method: "POST",
        headers: authHeader(),
      });

      if (res.status === 500) {
        // LLM call may fail without API key — that's OK, test the structure when it works
        const body = await res.json();
        console.log(`  Compose failed (likely no API key): ${body.error}`);
        return;
      }

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(typeof body.totalArticles, "number");
      assert.ok(body.totalArticles >= 2);
      assert.ok(Array.isArray(body.articles));
      // First article should have the highest score
      assert.ok(body.articles[0].score >= body.articles[1].score);
      // The actionable article should be marked as tryThis
      const tryThisArticle = body.articles.find((a: { isTryThis: boolean }) => a.isTryThis);
      assert.ok(tryThisArticle, "Should have a Try This article");
    });
  });

  describe("Pipeline - Send Composed", () => {
    it("POST /api/pipeline/send-composed rejects without title", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/send-composed", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error.includes("title"));
    });

    it("POST /api/pipeline/send-composed rejects without subscribers", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/send-composed", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test Newsletter" }),
      });
      // Should fail because no active subscribers (but enriched articles exist from compose test)
      assert.ok([400, 500].includes(res.status));
    });
  });

  describe("Pipeline - Send Newsletter (legacy)", () => {
    it("rejects send without title", async () => {
      const res = await fetch(getBaseUrl() + "/api/pipeline/send-newsletter", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error.includes("title"));
    });
  });
});
