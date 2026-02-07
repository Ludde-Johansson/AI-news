import { config } from "dotenv";

// Load .env file
config();

export const env = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  DATABASE_PATH: process.env.DATABASE_PATH || "./data/ai-news.db",
  BASE_URL: process.env.BASE_URL || "http://localhost:3000",
  FROM_EMAIL: process.env.FROM_EMAIL || "AI News Digest <onboarding@resend.dev>",
  // Gmail IMAP settings (Phase 2)
  GMAIL_USER: process.env.GMAIL_USER || "ludvig.ai.newsletter@gmail.com",
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  // Claude API (Phase 2)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};
