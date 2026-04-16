---
title: Freebuff–OpenCode Integration
description: Comprehensive documentation of the freebuff plugin integration with .opencode — covering plugin architecture, authentication, agent configuration, delegation pattern, and the companion freebuff-delegate agent
status: completed
priority: high
owner: AI
created: 2025-04-16
tags: [freebuff, opencode, plugin, architecture]
related_projects: []
---

# Freebuff–OpenCode Integration

## 1. What Is Freebuff?

Freebuff is a free-tier AI coding agent exposed through the **Codebuff SDK**. It runs on the `z-ai/glm-5.1` model under the agent ID `base2-free`, which is on the server's free-mode allowlist — meaning it consumes **0 credits** per invocation. The agent operates in **read-only advisory mode**: it can read files and analyze code, but cannot modify files or execute shell commands. Instead, it returns structured file-change proposals that the caller is responsible for applying.

## 2. Integration via `opencode.json`

The plugin is registered in the project root's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/kimi-k2.5",
  "agent": {
    "plan": {
      "model": "opencode-go/glm-5.1"
    }
  },
  "plugin": [".opencode/plugins/freebuff.mjs"]
}
```

The `"plugin"` array tells OpenCode to load `freebuff.mjs` at startup. The plugin exports a `server` function that registers tools into OpenCode's tool registry, making `freebuff` available as a callable tool for any OpenCode agent.

## 3. Plugin Architecture

### File: `.opencode/plugins/freebuff.mjs`

The plugin follows the **OpenCode plugin contract**: it exports a `server` async function that receives a `ctx` object and returns an object with a `tool` map.

```javascript
export const server = async (ctx) => {
  return {
    tool: {
      freebuff: tool({
        description: 'Delegate a task to freebuff…',
        args: {
          prompt: tool.schema
            .string()
            .describe('The task, question, or instruction to send to freebuff'),
          cwd: tool.schema
            .string()
            .optional()
            .describe('Working directory. Defaults to the project directory.'),
        },
        async execute(args) {
          const workingDir = args.cwd || ctx.directory || process.cwd();
          return runFreebuff(args.prompt, workingDir);
        },
      }),
    },
  };
};
```

**Key design decisions in the tool definition:**

- **Two args** — `prompt` (required) and `cwd` (optional). The `cwd` falls back to `ctx.directory` then `process.cwd()`.
- **Description explicitly warns** against pre-reading files: _"Do NOT read files before calling this tool — freebuff can read files itself."_ This prevents redundant context consumption.
- **Description instructs** the caller to apply freebuff's structured proposals using its own write tools after the call returns.

### Internal functions

| Function       | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `getAuthToken` | Reads `authToken` from `~/.config/manicode/credentials.json`  |
| `loadSDK`      | Lazy-loads `@codebuff/sdk`; caches `CodebuffClient` class     |
| `runFreebuff`  | Orchestrates auth → SDK load → client.run → stream → response |

## 4. Authentication Flow

### Credential location

```
~/.config/manicode/credentials.json
```

This file is created by running `freebuff login` in the terminal. It stores an auth token under the `default` profile.

### Token extraction

```javascript
function getAuthToken() {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
    return creds?.default?.authToken ?? null;
  } catch {
    return null;
  }
}
```

### Auth gate

If no token is found, the tool throws an error before making any network call:

```
freebuff is not logged in. Run `freebuff login` in your terminal first.
```

**Important:** Authentication is fully external to OpenCode — the plugin only reads the credential file; it never manages login state itself.

## 5. Agent Configuration — `FREE_AGENT`

The plugin defines a hardcoded agent object that determines how freebuff behaves on the Codebuff server:

```javascript
const FREE_AGENT = {
  id: 'base2-free',
  model: 'z-ai/glm-5.1',
  displayName: 'Freebuff (Free)',
  outputMode: 'last_message',
  includeMessageHistory: false,
  providerOptions: {
    data_collection: 'deny',
  },
  toolNames: [
    'read_files',
    'read_subtree',
    'list_directory',
    'glob',
    'set_output',
    'suggest_followups',
  ],
  spawnableAgents: [],
  instructionsPrompt: `You are a helpful coding assistant running in read-only advisory mode…`,
};
```

### Property breakdown

| Property                | Value          | Rationale                                               |
| ----------------------- | -------------- | ------------------------------------------------------- |
| `id`                    | `base2-free`   | Maps to server's free-tier allowlist                    |
| `model`                 | `z-ai/glm-5.1` | Free-tier model (0 credits when paired with id)         |
| `outputMode`            | `last_message` | Returns only the final response, not intermediates      |
| `includeMessageHistory` | `false`        | No prior conversation context — each call is standalone |
| `data_collection`       | `deny`         | Opt out of training data collection                     |
| `spawnableAgents`       | `[]`           | Cannot spawn sub-agents — single agent only             |
| `costMode` (at runtime) | `'free'`       | Passed in `client.run()`, enforces 0-credit billing     |

### Read-only tool set

The six allowed tools are all non-mutating:

| Tool                | Capability                          |
| ------------------- | ----------------------------------- |
| `read_files`        | Read one or more files              |
| `read_subtree`      | Recursively read directory contents |
| `list_directory`    | List files in a directory           |
| `glob`              | Find files by pattern               |
| `set_output`        | Return structured output            |
| `suggest_followups` | Suggest follow-up prompts           |

The `instructionsPrompt` reinforces read-only behavior and prescribes the **FILE/ACTION/SEARCH/REPLACE** format for proposing changes.

## 6. Delegation Pattern

The core integration pattern is **delegated read-only analysis → caller-applied changes**:

```
OpenCode (caller)                    Freebuff (agent)
      │                                    │
      │  1. Call freebuff({ prompt })      │
      │ ──────────────────────────────────> │
      │                                    │  2. Read files, analyze
      │                                    │     Propose changes as
      │                                    │     FILE/ACTION/SEARCH/REPLACE
      │  3. Structured text response       │
      │ <────────────────────────────────── │
      │                                    │
      │  4. Parse proposals                │
      │  5. Apply using write/edit tools   │
      │     (prompts user for permission)  │
      │                                    │
```

**Why this pattern?**

- **Safety** — Freebuff never writes; all writes go through OpenCode's permission system.
- **Cost** — Free-tier model + free costMode = zero credits.
- **Context efficiency** — The caller doesn't waste context reading files before delegating; freebuff reads them itself.
- **Second opinions** — OpenCode can use freebuff to get an independent analysis from a different model without consuming its own context budget.

**Streaming and timeout:** Results stream back via `handleStreamChunk` with a 5-minute `AbortController` timeout. The accumulated stream text is returned as the tool output.

## 7. Companion Agent — `freebuff-delegate`

Located at `.opencode/agents/freebuff-delegate.md`, this agent provides the **delegation layer** between the user and the freebuff tool.

### Frontmatter

```yaml
name: freebuff-delegate
description: >
  Delegates tasks to freebuff, a free AI coding agent…
permission:
  edit: ask
  bash:
    'rm *': ask
    'git *': ask
    '*': deny
  freebuff: allow
```

### Workflow (from agent instructions)

1. **Always call `freebuff` first** — never handle the task yourself.
2. **Parse the response** for FILE/ACTION/SEARCH/REPLACE markers.
3. **Apply the changes** using OpenCode's edit/write tools:
   - `ACTION: create|replace` → write the file
   - `ACTION: edit` with SEARCH/REPLACE → edit the file
   - File deletions → `rm` via bash
4. **Report what was done** — list created, edited, and deleted files.

### Rules

- Don't read files before calling freebuff — it reads them itself.
- Don't modify freebuff's proposals — apply as-is.
- Don't add changes beyond what freebuff proposed.
- Keep prompts to freebuff short and direct.
- If freebuff returns an answer with no proposals, relay it directly.

The `permission: freebuff: allow` grants this agent automatic access to the freebuff tool without prompting, while bash is restricted (`*': deny` except `rm *` and `git *` which require `ask`).

---

## Quick Reference

| Aspect          | Value / Location                                                 |
| --------------- | ---------------------------------------------------------------- |
| Plugin file     | `.opencode/plugins/freebuff.mjs`                                 |
| Registration    | `opencode.json` → `"plugin": [".opencode/plugins/freebuff.mjs"]` |
| Tool name       | `freebuff`                                                       |
| Credentials     | `~/.config/manicode/credentials.json` → `default.authToken`      |
| Agent ID        | `base2-free`                                                     |
| Model           | `z-ai/glm-5.1`                                                   |
| Cost mode       | `free` (0 credits)                                               |
| Tool count      | 6 (all read-only)                                                |
| Timeout         | 5 minutes                                                        |
| Delegate agent  | `.opencode/agents/freebuff-delegate.md`                          |
| Internal memory | `.opencode/memories/freebuff-plugin-architecture.md`             |
