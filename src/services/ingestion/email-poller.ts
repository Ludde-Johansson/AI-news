import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";
import { env } from "../../config.js";

export interface ParsedNewsletter {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  html: string;
  text: string;
}

export async function pollEmails(options?: { markAsRead?: boolean }): Promise<ParsedNewsletter[]> {
  const markAsRead = options?.markAsRead ?? true;
  if (!env.GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_APP_PASSWORD is required. Set it in .env file.");
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
    logger: false,
  });

  const newsletters: ParsedNewsletter[] = [];

  try {
    await client.connect();
    console.log("Connected to Gmail IMAP");

    // Select INBOX
    const mailbox = await client.mailboxOpen("INBOX");
    console.log(`Mailbox has ${mailbox.exists} total messages`);

    // Search for unread messages
    const searchResult = await client.search({ seen: false });
    const unreadUids = searchResult || [];
    console.log(`Found ${unreadUids.length} unread message(s)`);

    if (unreadUids.length === 0) {
      return newsletters;
    }

    // Fetch unread messages one by one
    for (const uid of unreadUids as number[]) {
      console.log(`Fetching message UID ${uid}...`);
      const fetchResult = await client.fetchOne(uid, { source: true }, { uid: true });

      if (!fetchResult) {
        console.log(`No message for UID ${uid}, skipping`);
        continue;
      }

      const source = fetchResult.source as Buffer | undefined;
      if (!source) {
        console.log(`No source for UID ${uid}, skipping`);
        continue;
      }

      const parsed = await simpleParser(source);
      const newsletter = parsedMailToNewsletter(parsed);

      if (newsletter) {
        newsletters.push(newsletter);

        // Mark as read after processing (skip in dry-run)
        if (markAsRead) {
          await client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
        }
        console.log(`Processed: ${newsletter.subject}`);
      }
    }

    return newsletters;
  } catch (error) {
    console.error("IMAP error:", error);
    throw error;
  } finally {
    await client.logout();
    console.log("Disconnected from Gmail IMAP");
  }
}

function parsedMailToNewsletter(parsed: ParsedMail): ParsedNewsletter | null {
  const messageId = parsed.messageId || `unknown-${Date.now()}`;
  const from = parsed.from?.text || "unknown";
  const subject = parsed.subject || "No subject";
  const date = parsed.date || new Date();
  const html = parsed.html || "";
  const text = parsed.text || "";

  // Skip if no content
  if (!html && !text) {
    console.log(`Skipping empty email: ${subject}`);
    return null;
  }

  return {
    messageId,
    from,
    subject,
    date,
    html: typeof html === "string" ? html : "",
    text,
  };
}

// Identify newsletter source from sender
export function identifySource(from: string): string {
  const fromLower = from.toLowerCase();

  if (fromLower.includes("deeplearning.ai") || fromLower.includes("the batch")) {
    return "the-batch";
  }
  if (fromLower.includes("alphasignal")) {
    return "alphasignal";
  }
  if (fromLower.includes("import ai")) {
    return "import-ai";
  }
  if (fromLower.includes("rundown")) {
    return "the-rundown";
  }

  // Default: use sanitized sender name
  return from
    .split("@")[0]
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
}
