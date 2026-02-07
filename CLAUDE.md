# AI News Newsletter

Node.js + TypeScript newsletter aggregator. See @docs/architecture.md for details.

## Command Execution (CRITICAL)

**Run every command separately. NEVER chain with && or ;**

```bash
# WRONG
git add . && git commit -m "msg"

# CORRECT
git add .
git commit -m "msg"
```

This is required so permission patterns match correctly.

## Commit & Push Often (CRITICAL)

**Commit and push frequently to avoid losing work.**

- Commit after completing each logical unit of work (a new file, a feature, a bug fix)
- Push to remote after every commit or small batch of commits
- When working on multi-step tasks, commit after each step — not at the end
- When using git worktrees or parallel branches, commit in each worktree before any cleanup operations
- Never let uncommitted work accumulate across many files
- Always push before doing any destructive git operations (worktree removal, branch deletion, rebases)

## References

- @docs/vision.md - Vision, strategy, roadmap, and content sources
- @docs/architecture.md - System design, data models, project structure
- @README.md - Quick start and current status
- @.claude/settings.json - Command permissions (pre-approved commands)
