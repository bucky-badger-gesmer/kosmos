# Kosmos — AI Context

AI orchestration workspace for OpenCode. For setup, structure, and discovery see `README.md`.

## File Naming

- Projects, todos, memories, ideas: `YYYY-MM-DD-descriptive-name.{project|todo|memory|idea}.md`
- Public/personal: `*/public/` = shared (committed), `*/personal/` = private (gitignored).

### Frontmatter

```yaml
---
title: Item title
description: Brief description
status: planning|active|paused|completed|pending|in_progress
priority: high|medium|low
owner: Person responsible
created: YYYY-MM-DD
due: YYYY-MM-DD (optional)
tags: [relevant, tags]
related_projects: [other-file-names]
---
```

## Platform Configuration

- **Main model:** `opencode-go/kimi-k2.5`
- **Plan agent:** `opencode-go/glm-5.1`

## Skills

`.opencode/skills/` — Domain-specific knowledge modules (integrations, tooling, design). See `.opencode/skills/README.md` for full list.

## Agents

`.opencode/agents/` — Organized by role (delegation, development, analysis). See `.opencode/agents/README.md` for full list.

## Workflow & Principles

### 1. Workflow orchestration (plan first)

- Every non-trivial task starts in plan mode. 3+ steps or any architectural decision — plan first.
- If something goes sideways mid-build, stop and re-plan. Don't keep pushing.
- Write detailed specs upfront. Ambiguity is the enemy of clean output.

### 2. Subagent strategy

- Use subagents to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, spin up multiple subagents. One task per subagent.
- Focused execution over cluttered multitasking.

### 3. Self-improvement loop

- After any correction from the user, update a lessons file (e.g. `memories/public/lessons.md`) with the pattern.
- Write rules that prevent the same mistake from happening again. Iterate until the mistake rate drops.
- Every session: review lessons relevant to the project. Compounding system — the longer you use it, the smarter it gets about your workflow.

### 4. Verification before done

- Never mark a task complete without proving it works.
- Before presenting: run tests, check output, demonstrate correctness.
- No "it should work" — only "here is proof it works."

### 5. Demand elegance

- For non-trivial changes, pause: "Is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes to avoid over-engineering.

### 6. Autonomous problem solving

- When given a bug or task, solve it. Use logs, errors, failing tests; resolve directly.
- Zero context switching required from the user.

### 7. Minimal impact

- Touch only what is necessary. Avoid introducing bugs.
- Make every change as simple as possible.
- Never modify dependencies without approval.

### Task management

1. **Plan first:** Write plan to `todos/` (e.g. a todo file) or `projects/` (e.g. a project file) with checkable items.
2. **Verify plan:** Check in before starting implementation.
3. **Track progress:** Mark items complete as you go.
4. **Explain changes:** High-level summary at each step.
5. **Document results:** Add review section to the todo/project file.
6. **Capture lessons:** Update lessons (e.g. `memories/public/lessons.md`) after every correction.

### Core principles

- **Simplicity first:** Make every change as simple as possible. Impact minimal code.
- **No laziness:** Find root causes. No temporary fixes. Senior developer standards only.
- **Never modify dependencies without approval:** Do not add, remove, or upgrade dependencies without explicit user approval.

## Code Standards

**Prettier** (`.prettierrc`): Single quotes, tab width 2, prose wrap preserve.

**EditorConfig**: LF line endings, UTF-8, 2-space indent for JSON/YAML/SH.

**Commits**: Use the `commit` skill for conventional commits.

## Environment

- Node.js: LTS (see `.nvmrc`)
- No test suite configured yet
- No CI/CD workflows
- Default branch: `main`

## Tips

- Check `memories/public/` before starting; link work via frontmatter; use tags.

## Key References

- Skill creation guide: `.opencode/skills/skill-creator/SKILL.md`
- JSON schemas: `.opencode/skills/skill-creator/references/schemas.md`
- Commit skill: `.opencode/skills/commit/SKILL.md`
