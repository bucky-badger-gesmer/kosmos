```
██╗  ██╗ ██████╗ ███████╗███╗   ███╗ ██████╗ ███████╗
██║ ██╔╝██╔═══██╗██╔════╝████╗ ████║██╔═══██╗██╔════╝
█████╔╝ ██║   ██║███████╗██╔████╔██║██║   ██║███████╗
██╔═██╗ ██║   ██║╚════██║██║╚██╔╝██║██║   ██║╚════██║
██║  ██╗╚██████╔╝███████║██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

# Kosmos

AI-powered development platform for knowledge management and workflow automation.

Kosmos is an intelligent orchestration layer that enhances your development workflow. It provides AI-powered agents, skills, and commands that streamline knowledge management and automate repetitive tasks from a single context.

## Directory Structure

```
kosmos/
├── .opencode/
│   ├── agents/         # Specialized AI agents
│   ├── commands/       # Slash commands for workflows
│   └── skills/         # Domain-specific skill modules
├── .vscode/            # VS Code settings and extensions
├── node_modules/       # Dependencies
├── opencode.json       # OpenCode configuration
├── package.json        # Project manifest
├── tui.json           # Terminal UI configuration
├── .editorconfig      # Editor consistency
├── .prettierrc        # Code formatting rules
├── .env.example       # Environment variable template
└── README.md          # This file
```

## Prerequisites

Before setting up, make sure you have the following installed:

- **Node.js** (see `.nvmrc` for version) — [nodejs.org](https://nodejs.org/)
- **npm** — included with Node.js
- **Git** — [git-scm.com](https://git-scm.com/)

## Local Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd kosmos
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment:**

   Copy `.env.example` to `.env` and fill in your values:
   - `YOUR_NAME`, `YOUR_EMAIL`
   - Any API keys needed for AI services

## OpenCode Configuration

Kosmos is built on the [OpenCode](https://opencode.ai) platform with the following setup:

| Component  | Configuration            |
| ---------- | ------------------------ |
| Main Model | `opencode-go/kimi-k2.5`  |
| Plan Agent | `opencode-go/glm-5.1`    |

## Platform Features

- **Commands** — See [`.opencode/commands/`](.opencode/commands/)
- **Agents** — See [`.opencode/agents/`](.opencode/agents/)
- **Skills** — See [`.opencode/skills/`](.opencode/skills/)

## Development

### Code Formatting

Format all files with Prettier:

```bash
npx prettier --write .
```

### Skills System

The **skill-creator** system provides modular, reusable workflows:

- Create custom skills for specific tasks
- Define agents, commands, and references
- Extensible architecture for team collaboration

See `.opencode/skills/skill-creator/` for examples and templates.

## File Naming

- Skills: `skill-name/SKILL.md`
- Agents: `agent-name.md`
- Commands: `command-name.md`
- Memory/context: `YYYY-MM-DD-descriptive-name.md`

## Support

- **Issues:** Report bugs or feature requests via GitHub Issues
- **Documentation:** See `.opencode/skills/skill-creator/SKILL.md` for skill development
- **Author:** Aaron Gesmer

## License

ISC License - see `package.json` for details.
