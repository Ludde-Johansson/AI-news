import Parser from "rss-parser";

export interface RssFeedConfig {
  name: string;
  url: string;
  source: string;
}

export const RSS_FEEDS: RssFeedConfig[] = [
  // AI labs
  {
    name: "Anthropic News",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    source: "anthropic-news",
  },
  {
    name: "Anthropic Engineering",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml",
    source: "anthropic-engineering",
  },
  {
    name: "Anthropic Research",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml",
    source: "anthropic-research",
  },
  {
    name: "Claude Code Changelog",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_changelog_claude_code.xml",
    source: "claude-code-changelog",
  },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", source: "openai-blog" },
  {
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    source: "deepmind-blog",
  },
  // Developer tools & platforms
  { name: "Vercel Blog", url: "https://vercel.com/atom", source: "vercel-blog" },
  {
    name: "Cursor Blog",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_cursor.xml",
    source: "cursor-blog",
  },
  // Independent voices
  { name: "Peter Steinberger", url: "https://steipete.me/rss.xml", source: "peter-steinberger" },
  {
    name: "Lex Fridman Podcast",
    url: "https://lexfridman.com/feed/podcast/",
    source: "lex-fridman",
  },
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    source: "simon-willison",
  },
  // VC & industry
  { name: "a16z Blog", url: "https://a16z.com/feed/", source: "a16z" },
];

export interface RssArticle {
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  source: string;
}

export async function pollRssFeeds(feeds?: RssFeedConfig[]): Promise<RssArticle[]> {
  const parser = new Parser();
  const targetFeeds = feeds || RSS_FEEDS;
  const articles: RssArticle[] = [];

  for (const feed of targetFeeds) {
    try {
      console.log(`Polling ${feed.name} (${feed.url})...`);
      const result = await parser.parseURL(feed.url);
      console.log(`  Found ${result.items.length} item(s)`);

      for (const item of result.items) {
        articles.push({
          title: item.title || "Untitled",
          content: item.contentSnippet || item.content || item.summary || "",
          url: item.link || "",
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          source: feed.source,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Error polling ${feed.name}: ${message}`);
    }
  }

  return articles;
}
