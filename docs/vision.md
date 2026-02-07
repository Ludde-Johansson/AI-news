# Vision & Strategy

## The Vision

Build a **public AI newsletter** that establishes thought leadership in the AI space.

## Long-term Goal

Create a recognized voice in AI news curation that:

- Helps land AI jobs through demonstrated expertise
- Contributes to public AI discourse
- Builds a personal brand in the AI community

## Why This Matters

The AI space moves fast. Most people can't keep up with:

- Research papers and breakthroughs
- Product launches and company news
- Policy developments and safety discussions
- Tool releases and technical tutorials

A well-curated newsletter that filters signal from noise becomes valuable. Done consistently, it establishes credibility.

## The Approach

**Human-in-the-loop curation** - Not fully automated. The value is in editorial judgment:

1. **Aggregate** from trusted sources (newsletters, blogs, RSS)
2. **Summarize** with Claude API to extract key points
3. **Curate** manually - select what matters, add perspective
4. **Deliver** via email to subscribers

## Roadmap

### Phase 1: Foundation + Manual Newsletter ✅

- Project scaffolding
- Database and models
- CLI tools for content management
- Basic email sending via Resend

### Phase 2: Content Pipeline ← CURRENT

- Email ingestion via IMAP polling (Gmail: ludvig.ai.newsletter@gmail.com)
- RSS feed polling
- Claude API summarization
- Automated article extraction

### Phase 3: Subscriber Growth

- Public landing page
- Double opt-in flow
- Unsubscribe handling
- Basic analytics (opens, clicks)

### Phase 4: Automation

- Scheduled sends (cron)
- Admin dashboard
- Draft preview workflow
- Content queue management

### Phase 5: PWA + Polish

- Personal reading archive
- Mobile-friendly PWA
- Improved admin UI
- Public archive for SEO

## Success Metrics

**Phase 1-2 (MVP):**

- Ship first newsletter to 2 subscribers
- Establish consistent weekly cadence

**Phase 3-4 (Growth):**

- 100 subscribers
- 40%+ open rate
- Positive feedback/replies

**Phase 5+ (Established):**

- 1000+ subscribers
- Recognized in AI community
- Speaking/job opportunities from visibility

## Content Sources

### Email Newsletters

| Source                | Why                              |
| --------------------- | -------------------------------- |
| The Batch (Andrew Ng) | Authoritative, weekly AI roundup |
| AlphaSignal           | Daily, good signal-to-noise      |
| Import AI             | Research-focused, thoughtful     |
| The Rundown AI        | Popular, broad coverage          |

### Blogs & RSS

| Source         | Why                          |
| -------------- | ---------------------------- |
| Anthropic Blog | Primary LLM provider updates |
| OpenAI Blog    | Major player announcements   |
| DeepMind Blog  | Research breakthroughs       |
| Hugging Face   | Open source ML community     |

### Manual Sources

- Twitter/X AI community
- Hacker News front page
- ArXiv notable papers
- Product Hunt AI launches
