---
name: agent-management
description: Delegation patterns for orchestrating subagents and agent teams. Use when deciding how to break work into delegatable chunks, selecting agent types, composing teams, or running parallel agents.
---

# Agent Management

You excel at orchestrating parallel work across subagents and agent teams. Your default is to delegate non-trivial tasks rather than executing everything in your own context window. Break work into parallel streams, dispatch agents with rich context, and synthesize results.

## Decision Framework

For every non-trivial task, choose one of three tiers:

| Tier            | When to Use                                                                                                            | Mechanism                      | Token Cost |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| **Direct**      | Simple questions, quick lookups, single-file edits, conversations needing back-and-forth. Under 2 minutes of work.     | Handle it yourself             | Low        |
| **Subagents**   | Focused tasks where only the result matters. Research, file searches, code analysis, writing drafts, running builds.   | `Agent` tool                   | Medium     |
| **Agent teams** | Complex work requiring coordination between agents. Multi-file features, cross-layer changes, parallel investigations. | Natural language team creation | High       |

### Subagents vs Agent Teams

Use **subagents** when workers don't need to talk to each other. Each subagent gets a fresh context window, does its job, and reports back. You synthesize.

Use **agent teams** when workers need to share findings, challenge each other, and coordinate on shared files. Teammates have a shared task list, can message each other directly, and self-claim work.

## Delegation Defaults by Task Type

| Task Type                | Default Approach                                      | Details                                                                                             |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Research / exploration   | Subagents in parallel                                 | Spawn 2-3 subagents with different search strategies. Synthesize findings.                          |
| Code changes (1-2 files) | Direct, or `/codex:rescue` if Codex plugin installed  | Fast enough to do yourself; Codex is a good fit for focused fixes.                                  |
| Code changes (3+ files)  | Subagent in worktree, or `/codex:rescue --background` | Use `isolation: "worktree"` for native subagents; Codex handles multi-file work in its own session. |
| Large feature / refactor | Agent team                                            | 3-5 teammates, each owning a module or layer.                                                       |
| Content creation         | Subagent via skill                                    | Route to the appropriate skill (press-release-writer, project-manager-analyst, etc.)                |
| Debugging                | Parallel subagents                                    | Spawn agents with competing hypotheses. See [Debugging Team Template](#debugging-team).             |
| Code review              | Agent team                                            | Split by concern: security, performance, test coverage. See [Review Team Template](#review-team).   |
| Project planning         | Subagents for research, direct for synthesis          | Delegate context gathering, synthesize the plan yourself.                                           |
| Multi-step workflows     | Task list + subagents                                 | Break into tasks, delegate each, track progress.                                                    |

## Team Templates

Reusable compositions for common scenarios. Reference these when creating agent teams.

### Debugging Team

Spawn when root cause is unclear. Agents investigate competing hypotheses and challenge each other.

```
Create an agent team to debug [problem description]. Spawn 3-5 teammates,
each investigating a different hypothesis:
- [Hypothesis 1]
- [Hypothesis 2]
- [Hypothesis 3]
Have them talk to each other to disprove each other's theories.
Update findings when consensus emerges.
```

### Review Team

Spawn for thorough code or document review. Each reviewer applies a different lens.

```
Create an agent team to review [target]. Spawn 3 reviewers:
- One focused on correctness and edge cases
- One checking security implications
- One validating test coverage and documentation
Have them each review and report findings.
```

### Feature Team

Spawn for multi-file feature work. Each teammate owns a layer or module.

```
Create an agent team to implement [feature]. Spawn teammates:
- Frontend: owns UI components and user-facing changes
- Backend: owns API endpoints and business logic
- Tests: owns test coverage for both layers
Require plan approval before any teammate makes changes.
```

For features with explicit governance checkpoints, parallel swim lanes, or Jira ticket intake, use **spec-kitty** instead — see the [software-development skill](../software-development/SKILL.md) Large Feature workflow. spec-kitty structures the `specify → plan → tasks → next` loop and manages worktree isolation automatically.

### Research Team

Spawn for broad investigation. Agents explore different sources in parallel.

```
Create an agent team to research [topic]. Spawn teammates:
- One searching the codebase for existing patterns
- One reviewing documentation and specs
- One checking external references (Jira, Honeycomb, etc.)
Synthesize findings into a brief.
```

## How to Delegate Well

### Plan first, then execute

Start with planning before any implementation. Understand the full scope, break work into delegatable chunks, get alignment with the user on the approach. Once the plan is solid, delegate execution to agents. A good plan means agents one-shot the implementation almost every time.

### Calibrate agent count to difficulty

Don't use the same number of agents for every task. Scale up based on complexity:

- Simple/focused task: 1 subagent
- Moderate research or multi-file change: 2-3 subagents
- Hard debugging or broad investigation: 5-10 subagents in parallel
- Large feature or refactor: agent team with 3-5 teammates

### Give rich context

Subagents don't inherit your conversation. Include everything they need in the spawn prompt: file paths, requirements, constraints, expected output format.

### Launch in parallel

If tasks are independent, spawn all subagents in a single message. Don't serialize what can be parallelized.

### Use worktree isolation

For code changes, use `isolation: "worktree"` so agents don't conflict with each other or your working directory.

### Synthesize, don't relay

When subagents return results, distill them into a concise answer. Don't dump raw agent output on the user.

### Don't box agents in

Give agents tools and goals. Don't force strict step-by-step workflows. Let the agent decide tool order, which files to read, and how to approach the problem. The more freedom the agent has, the better the results.

### Match agent to task

Use specialized agents in `.claude/agents/` when the task fits:

- **project-manager-analyst**: Break requirements into structured project plans
- **security-vulnerability-analyst**: CVE analysis and risk exceptions
- **press-release-writer**: Professional press releases
- **prd-evaluation-agent**: Evaluate PRDs against 5 criteria
- **micro-task-tracker**: Document small standalone tasks

Use `subagent_type` for built-in agent types:

- `Explore`: Codebase research and file discovery
- `Plan`: Architecture and implementation planning
- `claude-code-guide`: Questions about Claude Code features

### Codex delegation (opt-in, per user)

The `openai/codex-plugin-cc` plugin registers a `codex:codex-rescue` subagent and a `/codex:rescue` slash command. When the plugin is installed for the current user, Codex becomes the preferred path for implementation work.

**When to route to Codex:**

- Implementation tasks: refactors, bug fixes, writing tests, focused code edits
- Cross-model second opinions on tricky changes (different model, fresh eyes)
- Spending ChatGPT-sub compute instead of Anthropic API credits

**How to invoke:**

- `/codex:rescue <task>` — direct delegation
- Phrase requests as "have Codex fix X" or "ask Codex to refactor Y"
- Flags: `--background` for async (monitor with `/codex:status`, collect with `/codex:result`), `--fresh` for clean context, `--wait` to block until done, `--resume` to continue prior work

**Before dispatching Codex at a submodule worktree:** verify the worktree is on the latest default branch (`git log --oneline HEAD..origin/master`). If it's behind, fetch and pull first or create a fresh worktree. Pointing Codex at a stale worktree causes it to duplicate or conflict with already-merged code. See `reference_codex_dispatch_augeo_ai_sdks.md` in memory for the full pre-dispatch checklist.

**Availability check:**
The plugin is opt-in per user, not a repo-wide guarantee. Before routing heavy work to Codex, confirm `codex:codex-rescue` is in `/agents`. If it's not there, fall through to the standard subagent or agent-team defaults — don't block on the plugin being installed.

**Enabling Codex (for teammates):** The Nexus repo already registers OpenAI's marketplace via `.claude/settings.json`. A teammate opts in with:

```
/plugin install codex@openai-codex
/codex:setup
!codex login
```

### Best of N for critical tasks

For high-stakes work, launch 2-3 agents on the same task independently. Compare results and pick the best. This catches errors through redundancy.

```
Launch 3 subagents in parallel, each independently writing the migration script
for [task]. I'll compare their approaches and pick the best one.
```

### Self-testing

After an agent produces code, have it (or a separate agent) launch a subprocess to verify the work. Run the tests, run the build, or have the agent try to use its own output. Don't trust code that hasn't been exercised.

### Agents propose ideas

Point agents at feedback channels, bug reports, telemetry, and error logs. They can identify patterns, suggest fixes, and even put up PRs proactively. Don't limit agents to executing your instructions. Let them surface what needs attention.

### Automate repeated review feedback

When you see the same review comment or correction pattern 3+ times, stop commenting manually. Have an agent write a lint rule, a test, or a CLAUDE.md instruction that prevents the issue from recurring.

### Prototype rapidly

Use agents to generate many variations fast. For UI, features, or approaches, spawn agents to produce 5-20 prototypes. Try each, feel it out, pick the best. The cost of building a prototype is near zero. The cost of shipping the wrong thing is high.

### Ship today

If something can be done today, do it today. Speed compounds. Don't defer work that agents can execute right now. Queue up agents, let them run, review results, ship.

## Agent Team Configuration

### Team size

Start with 3-5 teammates. Aim for 5-6 tasks per teammate. Three focused teammates often outperform five scattered ones.

### Plan approval

For risky changes, require plan approval before teammates implement:

```
Spawn an architect teammate to refactor [module].
Require plan approval before they make any changes.
Only approve plans that include test coverage.
```

### Quality hooks

Use hooks to enforce quality gates:

- `TeammateIdle`: Run checks when a teammate finishes. Exit code 2 sends feedback and keeps them working.
- `TaskCompleted`: Run validation when a task is marked complete. Exit code 2 prevents completion.

## When NOT to Delegate

- The user is having a conversation and wants direct attention
- The task is trivial (under 30 seconds)
- The user explicitly says "you do this" or "don't delegate"
- Sensitive operations that need user confirmation at each step
- Sequential tasks where each step depends on the previous result and there's no parallelism to exploit

## Design Principles

These principles inform how the delegation system works:

1. **Architect, not rule writer.** Define goals and constraints. Let agents figure out coordination from context. (Google Paradigms of Intelligence research, March 2026)
2. **Uncorrelated context windows.** Fresh context windows for subagents produce better results than polluting a single window. This is a form of test-time compute.
3. **The bitter lesson applies.** Don't over-scaffold agent coordination. The model gets better at self-coordination with every release. Build for the model 6 months from now.
4. **Latent demand.** Watch what agents try to do and make it easier. If a subagent keeps wanting to message another subagent, that's a signal to use an agent team instead.
5. **Use the most capable model.** Less capable models often cost MORE tokens because they need more correction and handholding. A capable model one-shots what a weaker model takes three attempts to get right. Default to Opus for complex delegation. Use Sonnet or Haiku for subagents doing narrow, well-defined tasks.
