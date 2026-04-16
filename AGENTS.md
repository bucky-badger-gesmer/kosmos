# Kosmos — AI Context

AI orchestration workspace for OpenCode. For structure and plugin setup, see `opencode.json`.

## Platform Configuration

- **Main model:** `opencode-go/kimi-k2.5`
- **Plan agent:** `opencode-go/glm-5.1`
- **Plugin:** `.opencode/plugins/freebuff.mjs` (free AI delegation via Codebuff SDK)

## Commands

`.opencode/commands/` — Development and workflow slash commands. See `.opencode/commands/README.md` for full list.

## Skills

`.opencode/skills/` — Domain-specific knowledge modules (integrations, tooling, design). See `.opencode/skills/README.md` for full list.

## Agents

`.opencode/agents/` — Organized by role (delegation, development, analysis). See `.opencode/agents/README.md` for full list.

## Freebuff Plugin

Delegates tasks to a free AI model (GLM-5.1) via the `@codebuff/sdk`. Requires:

- Login: Run `freebuff login` in terminal first
- Credentials at: `~/.config/manicode/credentials.json`
- If not logged in: "freebuff is not logged in"

**Key behavior:** Freebuff is read-only. It proposes file changes as structured text (FILE/ACTION/SEARCH/REPLACE). The calling model applies the changes using its own write tools, which prompts the user for permission.

## Workflow & Principles

### 1. Plan first

- Every non-trivial task starts in plan mode. 3+ steps or any architectural decision — plan first.
- If something goes sideways mid-build, stop and re-plan. Don't keep pushing.

### 2. Subagent strategy

- Use subagents to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, spin up multiple subagents. One task per subagent.
- Use freebuff for tasks where free tokens matter more than speed.

### 3. Verification before done

- Never mark a task complete without proving it works.
- Before presenting: run tests, check output, demonstrate correctness.
- No "it should work" — only "here is proof it works."

### 4. Demand elegance

- For non-trivial changes, pause: "Is there a more elegant way?"
- Skip this for simple, obvious fixes to avoid over-engineering.

### 5. Autonomous problem solving

- When given a bug or task, solve it. Use logs, errors, failing tests; resolve directly.
- Zero context switching required from the user.

### 6. Minimal impact

- Touch only what is necessary. Avoid introducing bugs.
- Make every change as simple as possible.
- Never modify dependencies without approval.

## Code Standards

**Prettier** (`.prettierrc`): Single quotes, tab width 2, prose wrap preserve.

**EditorConfig**: LF line endings, UTF-8, 2-space indent for JSON/YAML/SH.

**Commits**: Use `/commit` command for conventional commits.

## Environment

- Node.js: LTS (see `.nvmrc`)
- No test suite configured yet
- No CI/CD workflows
- Default branch: `main`

## Key References

- Skill creation guide: `.opencode/skills/skill-creator/SKILL.md`
- JSON schemas: `.opencode/skills/skill-creator/references/schemas.md`
- Commit command: `.opencode/commands/commit.md`
