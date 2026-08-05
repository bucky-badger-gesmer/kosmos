# .opencode

Project-local configuration for OpenCode. Contains custom agents, skills, and memories.

## Agents

Specialized agents for multi-turn, focused tasks. Located in `agents/`.

| Agent            | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `javascript-pro` | Senior JavaScript developer for modern ES2023+ and Node.js 20+ projects  |
| `python-pro`     | Senior Python developer for type-safe, production-ready Python 3.12+ code |
| `resume-reviewer`| Expert resume reviewer for ATS optimization and career positioning        |

## Skills

Reusable skill definitions loaded on demand. Located in `skills/`.

| Skill             | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `agent-management`| Delegation patterns for orchestrating subagents and agent teams                    |
| `commit`          | Generate descriptive commit messages by analyzing git diffs                        |
| `create-pr`       | Create pull requests following Sentry conventions                                  |
| `find-docs`       | Retrieve up-to-date documentation and API references via Context7                  |
| `frontend-design` | Create distinctive, production-grade frontend interfaces with high design quality  |
| `grill-me`        | Interview the user relentlessly about a plan or design until shared understanding  |
| `neumorphism`     | Apply the Kosmos neumorphic "soft-touch" design system                             |
| `saa-question`    | Capture AWS SAA practice questions and append them to the flashcard deck           |
| `skill-creator`   | Create, modify, evaluate, and improve OpenCode skills with iterative testing       |

## Memories

Persistent context files for cross-session knowledge. Located in `memories/`.

| Memory                                  | Description                                       |
| --------------------------------------- | ------------------------------------------------- |
| `memory-template.md`                    | Template for new memory entries                   |
| `public/lessons.md`                     | Captured lessons and improvement patterns         |
| `public/2026-07-31-aws-vpc-lab.memory.md` | Notes from the AWS VPC lab session               |
