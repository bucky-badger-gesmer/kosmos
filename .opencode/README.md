# .opencode

Project-local configuration for OpenCode. Contains custom agents, commands, skills, plugins, and memories.

## Agents

Specialized agents for multi-turn, focused tasks. Located in `agents/`.

| Agent               | Description                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `freebuff-delegate` | Delegates tasks to freebuff, a free AI coding agent backed by Claude, GPT, Qwen, and DeepSeek |
| `javascript-pro`    | Senior JavaScript developer for modern ES2023+ and Node.js 20+ projects                       |
| `python-pro`        | Senior Python developer for type-safe, production-ready Python 3.12+ code                     |

## Commands

Custom slash commands. Located in `commands/`.

| Command   | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| `/commit` | Create well-formatted git commits with conventional commit messages |

## Skills

Reusable skill definitions loaded on demand. Located in `skills/`.

| Skill             | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `frontend-design` | Create distinctive, production-grade frontend interfaces with high design quality |
| `skill-creator`   | Create, modify, evaluate, and improve OpenCode skills with iterative testing      |

## Plugins

Runtime plugins that extend OpenCode with additional tools. Located in `plugins/`.

| Plugin         | Description                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| `freebuff.mjs` | Provides the `freebuff` tool for delegating tasks to the freebuff AI coding agent |

## Memories

Persistent context files for cross-session knowledge. Located in `memories/`.

| Memory                            | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `freebuff-plugin-architecture.md` | Architecture notes on the freebuff plugin integration |
