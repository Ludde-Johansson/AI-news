import type { Article } from "../../models/article.js";
import type { NewsletterIssue } from "../../models/newsletter-issue.js";
import type { NewsletterPlan, ComposedArticle } from "./composer.js";

// Legacy template data (backwards compatible with existing sender)
export interface TemplateData {
  issue: NewsletterIssue;
  articles: Article[];
  unsubscribeUrl: string;
  baseUrl: string;
}

// New template data using the composer output
export interface ComposedTemplateData {
  issue: NewsletterIssue;
  plan: NewsletterPlan;
  unsubscribeUrl: string;
  baseUrl: string;
}

// ─── Tag/badge rendering ────────────────────────────────────────

function renderTagsHtml(composed: ComposedArticle): string {
  const badges: string[] = [];

  if (composed.isTrending) {
    badges.push(
      `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;margin-right:4px;">Trending</span>`,
    );
  }

  if (composed.isTryThis) {
    badges.push(
      `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;margin-right:4px;">Try This</span>`,
    );
  }

  for (const tag of composed.tags) {
    badges.push(
      `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;background:#f3f4f6;color:#4b5563;margin-right:4px;">${escapeHtml(tag)}</span>`,
    );
  }

  return badges.join(" ");
}

function renderTagsText(composed: ComposedArticle): string {
  const parts: string[] = [];
  if (composed.isTrending) parts.push("[Trending]");
  if (composed.isTryThis) parts.push("[Try This]");
  for (const tag of composed.tags) {
    parts.push(`[${tag}]`);
  }
  return parts.join(" ");
}

// ─── Composed newsletter (new format: flat ranked list) ─────────

function renderTopStoryHtml(plan: NewsletterPlan): string {
  if (!plan.topStory) return "";

  const article = plan.topStory.article;
  const titleHtml = article.originalUrl
    ? `<a href="${escapeHtml(article.originalUrl)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(article.title)}</a>`
    : escapeHtml(article.title);

  return `
    <div style="margin-bottom:28px;padding:20px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;">Top Story</p>
      <h2 style="margin:0 0 8px 0;font-size:20px;color:#111827;">${titleHtml}</h2>
      ${plan.topStoryIntro ? `<p style="margin:0 0 12px 0;font-size:15px;color:#1e40af;font-style:italic;">${escapeHtml(plan.topStoryIntro)}</p>` : ""}
      <p style="margin:0 0 8px 0;">${renderTagsHtml(plan.topStory)}</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(article.summary || article.rawContent.substring(0, 300) + "...")}</p>
    </div>`;
}

function renderArticleItemHtml(composed: ComposedArticle): string {
  const article = composed.article;
  const titleHtml = article.originalUrl
    ? `<a href="${escapeHtml(article.originalUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(article.title)}</a>`
    : escapeHtml(article.title);

  return `
    <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
      <h3 style="margin:0 0 6px 0;font-size:16px;color:#111827;">${titleHtml}</h3>
      <p style="margin:0 0 6px 0;">${renderTagsHtml(composed)} <span style="font-size:11px;color:#9ca3af;">${escapeHtml(article.source)}</span></p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(article.summary || article.rawContent.substring(0, 300) + "...")}</p>
    </div>`;
}

export function renderComposedNewsletterHtml(data: ComposedTemplateData): string {
  const { issue, plan, unsubscribeUrl } = data;

  // Top story (highlighted)
  const topStoryHtml = renderTopStoryHtml(plan);

  // Try This (if different from top story)
  let tryThisHtml = "";
  if (plan.tryThis && !plan.tryThis.isTopStory) {
    const article = plan.tryThis.article;
    const titleHtml = article.originalUrl
      ? `<a href="${escapeHtml(article.originalUrl)}" style="color:#065f46;text-decoration:none;">${escapeHtml(article.title)}</a>`
      : escapeHtml(article.title);

    tryThisHtml = `
    <div style="margin-bottom:28px;padding:16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Try This</p>
      <h3 style="margin:0 0 6px 0;font-size:16px;color:#111827;">${titleHtml}</h3>
      <p style="margin:0 0 6px 0;">${renderTagsHtml(plan.tryThis)} <span style="font-size:11px;color:#9ca3af;">${escapeHtml(article.source)}</span></p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(article.summary || article.rawContent.substring(0, 300) + "...")}</p>
    </div>`;
  }

  // Remaining articles (flat ranked list, excluding top story and try this)
  const remaining = plan.articles.filter(
    (c) => !c.isTopStory && !(c.isTryThis && !c.isTopStory),
  );
  const articlesHtml = remaining.map(renderArticleItemHtml).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(issue.title)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:600px;margin:0 auto;padding:20px;">
  <header style="margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #2563eb;">
    <h1 style="margin:0;font-size:24px;color:#111827;">AI News Digest</h1>
    <p style="margin:8px 0 0 0;font-size:14px;color:#6b7280;">Issue #${issue.issueNumber} | ${formatDate(issue.createdAt)}</p>
  </header>

  <main>
    ${topStoryHtml}
    ${tryThisHtml}
    ${remaining.length > 0 ? `<h2 style="margin:0 0 16px 0;font-size:16px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">More Stories</h2>` : ""}
    ${articlesHtml}
  </main>

  <footer style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
    <p style="margin:0 0 8px 0;">You're receiving this because you subscribed to AI News Digest.</p>
    <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a></p>
  </footer>
</body>
</html>`.trim();
}

export function renderComposedNewsletterText(data: ComposedTemplateData): string {
  const { issue, plan, unsubscribeUrl } = data;

  const lines: string[] = [];
  lines.push("AI NEWS DIGEST");
  lines.push(`Issue #${issue.issueNumber} | ${formatDate(issue.createdAt)}`);
  lines.push("");

  // Top story
  if (plan.topStory) {
    const article = plan.topStory.article;
    lines.push("=== TOP STORY ===");
    lines.push("");
    lines.push(`## ${article.title}`);
    if (plan.topStoryIntro) {
      lines.push(`> ${plan.topStoryIntro}`);
    }
    lines.push(`${renderTagsText(plan.topStory)} | ${article.source}`);
    if (article.originalUrl) lines.push(`Link: ${article.originalUrl}`);
    lines.push("");
    lines.push(article.summary || article.rawContent.substring(0, 300) + "...");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Try This
  if (plan.tryThis && !plan.tryThis.isTopStory) {
    const article = plan.tryThis.article;
    lines.push("=== TRY THIS ===");
    lines.push("");
    lines.push(`## ${article.title}`);
    lines.push(`${renderTagsText(plan.tryThis)} | ${article.source}`);
    if (article.originalUrl) lines.push(`Link: ${article.originalUrl}`);
    lines.push("");
    lines.push(article.summary || article.rawContent.substring(0, 300) + "...");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Remaining articles
  const remaining = plan.articles.filter(
    (c) => !c.isTopStory && !(c.isTryThis && !c.isTopStory),
  );

  if (remaining.length > 0) {
    lines.push("=== MORE STORIES ===");
    lines.push("");

    for (const composed of remaining) {
      const article = composed.article;
      lines.push(`## ${article.title}`);
      lines.push(`${renderTagsText(composed)} | ${article.source}`);
      if (article.originalUrl) lines.push(`Link: ${article.originalUrl}`);
      lines.push("");
      lines.push(article.summary || article.rawContent.substring(0, 300) + "...");
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  lines.push("You're receiving this because you subscribed to AI News Digest.");
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);

  return lines.join("\n").trim();
}

// ─── Legacy template (backwards compatible) ─────────────────────

export function renderNewsletterHtml(data: TemplateData): string {
  const { issue, articles, unsubscribeUrl } = data;

  const articleHtml = articles
    .map(
      (article) => `
    <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #111827;">
        ${article.originalUrl ? `<a href="${article.originalUrl}" style="color: #2563eb; text-decoration: none;">${escapeHtml(article.title)}</a>` : escapeHtml(article.title)}
      </h2>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
        Source: ${escapeHtml(article.source)}
        ${article.categories.length > 0 ? ` | ${article.categories.map((c) => escapeHtml(c)).join(", ")}` : ""}
      </p>
      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
        ${escapeHtml(article.summary || article.rawContent.substring(0, 300) + "...")}
      </p>
    </div>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(issue.title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <header style="margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #2563eb;">
    <h1 style="margin: 0; font-size: 24px; color: #111827;">AI News Digest</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">Issue #${issue.issueNumber} | ${formatDate(issue.createdAt)}</p>
  </header>

  <main>
    <h2 style="margin: 0 0 24px 0; font-size: 20px; color: #111827;">${escapeHtml(issue.title)}</h2>
    ${articleHtml}
  </main>

  <footer style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    <p style="margin: 0 0 8px 0;">
      You're receiving this because you subscribed to AI News Digest.
    </p>
    <p style="margin: 0;">
      <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a>
    </p>
  </footer>
</body>
</html>
  `.trim();
}

export function renderNewsletterText(data: TemplateData): string {
  const { issue, articles, unsubscribeUrl } = data;

  const articleText = articles
    .map(
      (article) =>
        `## ${article.title}
Source: ${article.source}${article.categories.length > 0 ? ` | ${article.categories.join(", ")}` : ""}
${article.originalUrl ? `Link: ${article.originalUrl}` : ""}

${article.summary || article.rawContent.substring(0, 300) + "..."}
`,
    )
    .join("\n---\n\n");

  return `
AI NEWS DIGEST
Issue #${issue.issueNumber} | ${formatDate(issue.createdAt)}

${issue.title}

${articleText}

---
You're receiving this because you subscribed to AI News Digest.
Unsubscribe: ${unsubscribeUrl}
  `.trim();
}

// ─── Helpers ────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
