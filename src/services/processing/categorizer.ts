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
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. Set it in your .env file or environment.",
    );
  }

  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  return client;
}

export async function categorizeArticle(
  rawContent: string,
  title: string,
): Promise<string[]> {
  const anthropic = getClient();

  const truncatedContent = rawContent.slice(0, 4000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 200,
    system: `You are a news categorizer for an AI newsletter. Categorize the article into one or more of these categories: ${VALID_CATEGORIES.join(", ")}. Respond with ONLY a JSON array of category strings, e.g. ["llm", "research"]. No other text.`,
    messages: [
      {
        role: "user",
        content: `Title: ${title}\n\nContent: ${truncatedContent}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const parsed = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.every((c: unknown) =>
        VALID_CATEGORIES.includes(c as (typeof VALID_CATEGORIES)[number]),
      )
    ) {
      return parsed;
    }
    return ["other"];
  } catch {
    return ["other"];
  }
}
