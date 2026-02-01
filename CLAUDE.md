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

## References

- @docs/vision.md - Vision, strategy, roadmap, and content sources
- @docs/architecture.md - System design, data models, project structure
- @README.md - Quick start and current status
- @.claude/settings.json - Command permissions (pre-approved commands)
