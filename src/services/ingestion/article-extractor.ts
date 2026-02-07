import * as cheerio from "cheerio";

export interface ExtractedArticle {
  title: string;
  content: string;
  url?: string;
}

export function extractArticles(html: string, source: string): ExtractedArticle[] {
  const $ = cheerio.load(html);

  switch (source) {
    case "alphasignal":
      return extractAlphaSignal($);
    case "the-batch":
      return extractTheBatch($);
    case "import-ai":
      return extractImportAI($);
    case "the-rundown":
      return extractTheRundown($);
    default:
      // Fallback: return whole content as single article
      return [{ title: "Newsletter", content: $.text().trim() }];
  }
}

function extractAlphaSignal($: cheerio.CheerioAPI): ExtractedArticle[] {
  const articles: ExtractedArticle[] = [];

  // AlphaSignal uses sections with headlines
  // Look for content blocks with titles and descriptions
  $("table").each((_, table) => {
    const $table = $(table);
    const title = $table.find("h2, h3, strong").first().text().trim();
    const content = $table.find("p").text().trim();
    const link = $table.find("a[href]").first().attr("href");

    if (title && content && title.length > 5 && content.length > 50) {
      // Skip navigation/header/footer content
      if (
        !title.toLowerCase().includes("unsubscribe") &&
        !title.toLowerCase().includes("view in browser")
      ) {
        articles.push({
          title,
          content,
          url: link,
        });
      }
    }
  });

  return articles.length > 0
    ? articles
    : [{ title: "AlphaSignal Newsletter", content: $.text().trim() }];
}

function extractTheBatch($: cheerio.CheerioAPI): ExtractedArticle[] {
  const articles: ExtractedArticle[] = [];

  // The Batch typically has article sections
  $("table").each((_, table) => {
    const $table = $(table);
    const title = $table.find("h2, h3").first().text().trim();
    const content = $table.find("p").text().trim();
    const link = $table.find("a[href]").first().attr("href");

    if (title && content && title.length > 5 && content.length > 50) {
      articles.push({
        title,
        content,
        url: link,
      });
    }
  });

  return articles.length > 0
    ? articles
    : [{ title: "The Batch Newsletter", content: $.text().trim() }];
}

function extractImportAI($: cheerio.CheerioAPI): ExtractedArticle[] {
  const articles: ExtractedArticle[] = [];

  // Import AI (by Jack Clark) is research-focused
  // HTML emails use bold/strong section headers followed by description paragraphs in table cells
  $("table").each((_, table) => {
    const $table = $(table);
    const header = $table.find("strong, b, h2, h3").first().text().trim();
    const content = $table.find("p").text().trim();
    const link = $table.find("a[href]").first().attr("href");

    if (header && content && header.length > 5 && content.length > 50) {
      if (
        !header.toLowerCase().includes("unsubscribe") &&
        !header.toLowerCase().includes("view in browser") &&
        !header.toLowerCase().includes("import ai") &&
        !header.toLowerCase().includes("forward this")
      ) {
        articles.push({
          title: header,
          content,
          url: link,
        });
      }
    }
  });

  return articles.length > 0
    ? articles
    : [{ title: "Import AI Newsletter", content: $.text().trim() }];
}

function extractTheRundown($: cheerio.CheerioAPI): ExtractedArticle[] {
  const articles: ExtractedArticle[] = [];

  // The Rundown AI uses structured sections with emoji headers, bold titles, paragraph content
  $("table").each((_, table) => {
    const $table = $(table);
    const title = $table.find("h2, h3, strong").first().text().trim();
    const paragraphs = $table.find("p");
    const content = paragraphs
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t: string) => t.length > 0)
      .join(" ");
    const link = $table.find("a[href]").first().attr("href");

    if (title && content && title.length > 3 && content.length > 50) {
      const titleLower = title.toLowerCase();
      if (
        !titleLower.includes("unsubscribe") &&
        !titleLower.includes("view in browser") &&
        !titleLower.includes("share this") &&
        !titleLower.includes("advertise") &&
        !titleLower.includes("sponsor")
      ) {
        articles.push({
          title: cleanTitle(title),
          content,
          url: link,
        });
      }
    }
  });

  return articles.length > 0
    ? articles
    : [{ title: "The Rundown AI Newsletter", content: $.text().trim() }];
}

function cleanTitle(title: string): string {
  return title
    .replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*/u, "")
    .trim();
}
