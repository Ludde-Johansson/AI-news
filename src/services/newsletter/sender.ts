import { Resend } from "resend";
import type { Article } from "../../models/article.js";
import type { NewsletterIssue } from "../../models/newsletter-issue.js";
import type { Subscriber } from "../../models/subscriber.js";
import { renderNewsletterHtml, renderNewsletterText } from "./template.js";

// Use Resend's official test address for sandbox, or set FROM_EMAIL env var for production
const FROM_EMAIL = process.env.FROM_EMAIL || "AI News Digest <onboarding@resend.dev>";

export interface SendResult {
  subscriber: Subscriber;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendNewsletterResult {
  issue: NewsletterIssue;
  results: SendResult[];
  successCount: number;
  failureCount: number;
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

function getBaseUrl(): string {
  return process.env.BASE_URL || "http://localhost:3000";
}

function getUnsubscribeUrl(subscriber: Subscriber): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/unsubscribe/${subscriber.unsubscribeToken}`;
}

export async function sendNewsletterToSubscriber(
  issue: NewsletterIssue,
  articles: Article[],
  subscriber: Subscriber
): Promise<SendResult> {
  const resend = getResendClient();
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = getUnsubscribeUrl(subscriber);

  const html = renderNewsletterHtml({
    issue,
    articles,
    unsubscribeUrl,
    baseUrl,
  });

  const text = renderNewsletterText({
    issue,
    articles,
    unsubscribeUrl,
    baseUrl,
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: subscriber.email,
      subject: `AI News Digest #${issue.issueNumber}: ${issue.title}`,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      },
    });

    if (result.error) {
      return {
        subscriber,
        success: false,
        error: result.error.message,
      };
    }

    return {
      subscriber,
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    return {
      subscriber,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendNewsletterToAll(
  issue: NewsletterIssue,
  articles: Article[],
  subscribers: Subscriber[]
): Promise<SendNewsletterResult> {
  const results: SendResult[] = [];

  for (const subscriber of subscribers) {
    const result = await sendNewsletterToSubscriber(issue, articles, subscriber);
    results.push(result);

    // Small delay between sends to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    issue,
    results,
    successCount,
    failureCount,
  };
}
