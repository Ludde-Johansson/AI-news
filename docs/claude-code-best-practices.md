# Claude Code Best Practices

Best practices for configuring Claude Code projects, based on official Anthropic documentation and community guidelines.

## CLAUDE.md Guidelines

### What It Is

CLAUDE.md is a markdown file that Claude automatically loads at the start of every conversation. It provides persistent, project-specific context.

### Keep It Short

- **Target:** <60 lines (ideal), <300 lines (maximum)
- **Why:** Claude can reliably follow ~150-200 instructions total. The system prompt already uses ~50. Long CLAUDE.md files cause Claude to ignore rules.

> "Claude will ignore the contents of your CLAUDE.md if it decides it is not relevant to its current task."

### What to Include

| Include                               | Example                                        |
| ------------------------------------- | ---------------------------------------------- |
| One-line project context              | "Node.js + TypeScript newsletter aggregator"   |
| Commands Claude can't guess           | Custom CLI flags, non-standard build commands  |
| Code style that differs from defaults | "Use ES modules, not CommonJS"                 |
| Workflow rules                        | "Run commands separately, never chain with &&" |
| Pointers to detailed docs             | `@docs/architecture.md`                        |

### What NOT to Include

| Exclude                             | Why                                     |
| ----------------------------------- | --------------------------------------- |
| Project vision/roadmap              | Put in README.md (human documentation)  |
| Detailed architecture               | Put in docs/ folder, reference with `@` |
| Pre-approved commands               | Put in `.claude/settings.json`          |
| Style rules a linter handles        | Use actual linters (ESLint, Prettier)   |
| Anything Claude can infer from code | Wastes context                          |

### Use `@` Syntax for References

Instead of copying content into CLAUDE.md, point to files:

```markdown
## References

- @docs/architecture.md - System design
- @README.md - Project overview
```

Claude will read these files when relevant.

---

## File Organization

### Recommended Structure

```
CLAUDE.md                    # Agent rules only (~30-60 lines)
README.md                    # Human-facing project docs
docs/
├── architecture.md          # Technical reference
└── [domain-docs].md         # Domain knowledge, API docs
.claude/
├── settings.json            # Permission rules (checked in)
├── settings.local.json      # Personal overrides (gitignored)
├── agents/                  # Custom subagents
└── skills/                  # Custom skills
```

### CLAUDE.md Locations (Hierarchy)

Claude reads CLAUDE.md files from multiple locations, most specific wins:

1. `~/.claude/CLAUDE.md` - Global (all projects)
2. `./CLAUDE.md` - Project root (team-shared)
3. `./CLAUDE.local.md` - Project root (gitignored, personal)
4. `./subdir/CLAUDE.md` - Directory-specific (loaded when working in that dir)

---

## Permissions (settings.json)

### Structure

```json
{
  "permissions": {
    "allow": ["Bash(npm *)", "Bash(git add *)", "Bash(git commit *)"],
    "deny": ["Bash(rm -rf *)", "Bash(git push --force*)"]
  }
}
```

### Best Practices

- Put command approvals here, NOT in CLAUDE.md
- Use wildcards (`*`) for flexibility
- Deny dangerous operations explicitly
- Use `settings.local.json` for personal overrides

---

## Command Execution

### The Golden Rule

**Run every command separately. Never chain with `&&` or `;`**

```bash
# WRONG - permission patterns won't match
git add . && git commit -m "msg"

# CORRECT - each command matches its permission pattern
git add .
git commit -m "msg"
```

### Why This Matters

Permission patterns in `settings.json` match individual commands. Chained commands (`&&`, `;`, `|`) create compound strings that don't match the patterns, triggering permission prompts.

---

## Hooks vs CLAUDE.md Instructions

| Use           | When                                                |
| ------------- | --------------------------------------------------- |
| **CLAUDE.md** | Advisory guidelines Claude should follow            |
| **Hooks**     | Actions that MUST happen every time (deterministic) |

Example: "Run prettier after editing" in CLAUDE.md is advisory. A hook guarantees it runs.

---

## Skills and Agents

### Skills (`.claude/skills/`)

On-demand knowledge Claude loads when relevant:

```markdown
# .claude/skills/api-conventions/SKILL.md

---

name: api-conventions
description: REST API design conventions

---

- Use kebab-case for URL paths
- Use camelCase for JSON properties
```

### Custom Subagents (`.claude/agents/`)

Specialized assistants for isolated tasks:

```markdown
# .claude/agents/security-reviewer.md

---

name: security-reviewer
description: Reviews code for security issues
tools: Read, Grep, Glob

---

You are a security engineer. Review for injection, auth flaws, secrets in code.
```

---

## Common Mistakes

| Mistake                         | Fix                                       |
| ------------------------------- | ----------------------------------------- |
| CLAUDE.md too long              | Prune ruthlessly, move details to docs/   |
| Duplicating linter rules        | Use actual linters, remove from CLAUDE.md |
| Listing pre-approved commands   | Put in settings.json instead              |
| Stuffing everything in one file | Use progressive disclosure with `@` refs  |
| Not iterating on CLAUDE.md      | Treat it like code - review and refine    |

---

## Sources

- [Anthropic Best Practices](https://code.claude.com/docs/en/best-practices)
- [Writing a good CLAUDE.md - HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [The Complete Guide to CLAUDE.md - Builder.io](https://www.builder.io/blog/claude-md-guide)
- [Creating the Perfect CLAUDE.md - Dometrain](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/)
