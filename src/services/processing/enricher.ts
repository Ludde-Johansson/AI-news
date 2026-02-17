import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config.js";

let client: Anthropic | null = null;

const VALID_CATEGORIES = [
  "llm",
  "safety",
  "research",
  "tools",
  "policy",
  "business",
  "open-source",
  "robotics",
  "computer-vision",
  "other",
] as const;

function getClient(): Anthropic {
  if (!env.CLAUDE_API_KEY) {
    throw new Error(
      "CLAUDE_API_KEY is required. Set it in your .env file or environment."
    );
  }

  if (!client) {
    client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  }

  return client;
}

export interface EnrichmentResult {
  summary: string;
  categories: string[];
  relevanceScore: number;
  isActionable: boolean;
}

const SYSTEM_PROMPT = `You are an AI news analyst for a newsletter targeting developers and AI practitioners.

For each article, provide ALL of the following in a single JSON response:

1. "summary": A 2-3 sentence summary. Be factual and neutral. No preamble.
2. "categories": Array of 1-3 categories from this list: ${VALID_CATEGORIES.join(", ")}
3. "relevance_score": Integer 1-10 rating how important/interesting this is to an AI-focused developer audience:
   - 10: Major breakthrough, paradigm shift, or critical industry event
   - 8-9: Significant new model, tool release, or important research result
   - 6-7: Useful update, interesting research, or notable industry move
   - 4-5: Incremental update, niche research, or minor news
   - 1-3: Tangential, redundant, or low-signal content
4. "is_actionable": true if this article announces a specific tool, product, API, or update that a developer could try or use today. false otherwise.

Respond with ONLY valid JSON. No markdown fences, no extra text.

Example response:
{"summary":"OpenAI released GPT-5 with significant improvements in reasoning and code generation. The model shows 40% improvement on standard benchmarks and is available via API today.","categories":["llm","tools"],"relevance_score":9,"is_actionable":true}`;

export async function enrichArticle(
  rawContent: string,
  title: string,
  source: string,
): Promise<EnrichmentResult> {
  const anthropic = getClient();

  const truncatedContent = rawContent.slice(0, 4000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Source: ${source}\nTitle: ${title}\n\nContent: ${truncatedContent}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const parsed = JSON.parse(text);

    // Validate and sanitize
    const summary =
      typeof parsed.summary === "string" && parsed.summary.length > 0
        ? parsed.summary
        : `${title} - from ${source}`;

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((c: unknown) =>
          VALID_CATEGORIES.includes(c as (typeof VALID_CATEGORIES)[number]),
        )
      : ["other"];

    const relevanceScore =
      typeof parsed.relevance_score === "number" &&
      parsed.relevance_score >= 1 &&
      parsed.relevance_score <= 10
        ? Math.round(parsed.relevance_score)
        : 5;

    const isActionable =
      typeof parsed.is_actionable === "boolean"
        ? parsed.is_actionable
        : false;

    return {
      summary,
      categories: categories.length > 0 ? categories : ["other"],
      relevanceScore,
      isActionable,
    };
  } catch {
    // If JSON parsing fails, fall back to basic enrichment
    return {
      summary: `${title} - from ${source}`,
      categories: ["other"],
      relevanceScore: 5,
      isActionable: false,
    };
  }
}
