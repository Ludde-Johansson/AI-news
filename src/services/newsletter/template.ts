import type { Article } from "../../models/article.js";
import type { NewsletterIssue } from "../../models/newsletter-issue.js";

export interface TemplateData {
  issue: NewsletterIssue;
  articles: Article[];
  unsubscribeUrl: string;
  baseUrl: string;
}

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
  `
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
`
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
