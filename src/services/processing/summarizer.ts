import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. Set it in your .env file or environment."
    );
  }

  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  return client;
}

export async function summarizeArticle(
  rawContent: string,
  title: string
): Promise<string> {
  const anthropic = getClient();

  const truncatedContent = rawContent.slice(0, 4000);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 300,
    system:
      "You are a news summarizer for an AI newsletter. Create a 2-3 sentence summary of the article. Be factual and neutral. Do not include any preamble like 'Here is a summary' - just provide the summary directly.",
    messages: [
      {
        role: "user",
        content: `Title: ${title}\n\nContent: ${truncatedContent}`,
      },
    ],
  });

  const summary = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return summary;
}
