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

See [PLAN.md](/PLAN.md) for roadmap and progress tracking.

## Content Sources

### Email Newsletters

| Source                | Why                              |
| --------------------- | -------------------------------- |
| The Batch (Andrew Ng) | Authoritative, weekly AI roundup |
| AlphaSignal           | Daily, good signal-to-noise      |
| Import AI             | Research-focused, thoughtful     |
| The Rundown AI        | Popular, broad coverage          |

### Blogs & RSS (Active)

| Source              | Why                                  | Status |
| ------------------- | ------------------------------------ | ------ |
| Anthropic Blog      | Primary LLM provider updates         | Active |
| OpenAI Blog         | Major player announcements           | Active |
| DeepMind Blog       | Research breakthroughs               | Active |
| Vercel Blog         | AI-powered DX, Next.js + AI          | Active |
| Cursor Blog         | AI coding tools, editor UX           | Active |
| Peter Steinberger   | OpenClaw, AI legal/open-source       | Active |
| Lex Fridman         | Long-form AI interviews/insights     | Active |

### Blogs & RSS (Candidates)

| Source              | Why                          |
| ------------------- | ---------------------------- |
| Hugging Face        | Open source ML community     |
| Simon Willison      | LLM tooling, practical AI    |
| Lenny's Newsletter  | AI product strategy          |
| a16z AI             | VC perspective on AI trends  |

### Manual Sources

- Twitter/X AI community
- Hacker News front page (also used for automated trending detection)
- ArXiv notable papers
- Product Hunt AI launches

### Source Discovery

Nice-to-have: mechanism to discover new relevant sources as they emerge. Example: Peter Steinberger became relevant because of OpenClaw — emerging voices can be just as valuable as established ones. Could monitor HN/Twitter for recurring authors covering AI topics.