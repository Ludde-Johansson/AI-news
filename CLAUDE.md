# Claude Code Instructions

## Command Execution Rules

1. **Run commands one at a time** - Never chain commands with `&&` or `;`. Run each command separately so permission patterns can match correctly.

2. **Git workflow** - Run git commands as separate steps:
   - First: `git add <files>`
   - Then: `git commit -m "message"`
   - Then: `git push`

## Project Context

This is a personalized AI news aggregator. See [design.md](design.md) for architecture details.

### Tech Stack

- Node.js + TypeScript
- SQLite (better-sqlite3)
- Express API
- PWA frontend
- Claude API for summarization
