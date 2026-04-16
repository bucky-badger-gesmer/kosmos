---
title: Freebuff Plugin End-to-End Architecture
description: Complete explanation of how the freebuff plugin works including auth flow, agent configuration, and SDK communication with codebuff server
status: active
priority: high
owner: freebuff-delegate
created: 2026-04-16
tags: [freebuff, plugin, opencode, authentication, sdk, architecture]
related_projects: [kosmos]
---

# Freebuff Plugin End-to-End Architecture

## Summary

The freebuff plugin acts as a bridge between OpenCode and the Codebuff SDK, enabling delegation of coding tasks to a free AI agent (model: z-ai/glm-5.1) while keeping all file-writing capabilities under OpenCode's control. The plugin operates in read-only advisory mode and returns structured file change proposals.

## Details

### 1. Plugin Registration (opencode.json)

The plugin is registered in the project root's `opencode.json`:

```json
{
  "plugin": [".opencode/plugins/freebuff.mjs"]
}
```

This tells OpenCode to load `freebuff.mjs` as a plugin. The plugin exports a `server` function that provides tools to OpenCode.

### 2. Tool Registration

The plugin registers a single tool called `freebuff`:

```javascript
export const server = async (ctx) => {
  return {
    tool: {
      freebuff: tool({ ... })
    },
  };
};
```

When the `freebuff` tool is used in OpenCode:

- Accepts a `prompt` (required) and `cwd` (optional)
- Does NOT read files itself — passes the user's request directly to freebuff
- Expects freebuff to return structured file change proposals
- Applies those changes using OpenCode's own write tools

### 3. Authentication Flow

The plugin reads credentials from a local file:

```javascript
const CREDENTIALS_PATH = join(
  homedir(),
  '.config',
  'manicode',
  'credentials.json',
);
```

**Auth Token Extraction:**

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

**Auth Check:**

```javascript
const apiKey = getAuthToken();
if (!apiKey) {
  throw new Error('freebuff is not logged in. Run `freebuff login` first.');
}
```

**Note:** Users must run `freebuff login` in their terminal first to create the credentials file.

### 4. Agent Configuration (Free Mode)

The plugin defines a hardcoded `FREE_AGENT`:

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
  instructionsPrompt: `...`, // Read-only advisory instructions
};
```

**Key Details:**

- **Agent ID**: `base2-free` + **Model**: `z-ai/glm-5.1` = **0 credits** (free mode allowlist)
- **outputMode**: `last_message` — only returns the final message
- **includeMessageHistory**: `false` — no conversation context
- **toolNames**: Limited to read-only operations
- **instructionsPrompt**: Defines the agent as a read-only advisory assistant

### 5. SDK Communication with Codebuff Server

**SDK Loading (Lazy):**

```javascript
async function loadSDK() {
  if (!CodebuffClient) {
    const sdk = await import('@codebuff/sdk');
    CodebuffClient = sdk.CodebuffClient;
  }
  return CodebuffClient;
}
```

**Client Initialization:**

```javascript
const ClientClass = await loadSDK();
const client = new ClientClass({ apiKey, cwd });
```

**Task Execution:**

```javascript
const result = await client.run({
  agent: FREE_AGENT,
  prompt,
  costMode: 'free',
  signal: controller.signal,
  handleStreamChunk: (chunk) => { ... },
});
```

**Communication Details:**

1. **costMode: 'free'** — explicitly requests free tier (no credits)
2. **signal** — AbortController for timeout handling (5 minutes)
3. **handleStreamChunk** — Processes streaming response chunks:
   - String chunks appended to `streamedText`
   - Subagent chunks also appended
4. **Timeout**: After 5 minutes, aborts and returns "freebuff timed out"

**Response Processing:**

```javascript
if (result.output?.type === 'error') {
  return `freebuff error: ${result.output.message}`;
}

const outputText =
  streamedText.trim() ||
  result.output?.message ||
  result.output?.text ||
  '(freebuff returned no output)';
```

### Complete End-to-End Flow

```
User calls freebuff tool in OpenCode
         ↓
Plugin loads @codebuff/sdk dynamically
         ↓
Reads auth token from ~/.config/manicode/credentials.json
         ↓
Creates CodebuffClient with apiKey and working directory
         ↓
Calls client.run() with FREE_AGENT (id: base2-free, model: z-ai/glm-5.1)
         ↓
Server validates costMode='free' matches allowlist (0 credits)
         ↓
Freebuff agent processes request using read-only tools
         ↓
Response streamed back via handleStreamChunk()
         ↓
Plugin returns structured output to OpenCode
         ↓
OpenCode applies FILE/ACTION/SEARCH/REPLACE proposals
```

## Key Points

- **Bridge Architecture**: The plugin bridges OpenCode with Codebuff SDK while keeping file-writing under OpenCode's control
- **External Authentication**: Credentials stored in `~/.config/manicode/credentials.json` via `freebuff login`
- **Free Tier Only**: Hardcoded agent config ensures 0-credit usage (base2-free + z-ai/glm-5.1)
- **Read-Only Mode**: Agent can only read files, analyze, and propose changes via structured markers
- **Lazy Loading**: SDK only loaded when tool is called
- **Streaming**: Results stream in real-time with 5-minute timeout
- **Tool Limitations**: Limited to 6 read-only tools (read_files, read_subtree, list_directory, glob, set_output, suggest_followups)

## Context

This architecture is important when:

- Understanding how to delegate tasks to freebuff effectively
- Debugging authentication issues (check credentials.json)
- Understanding why freebuff cannot modify files directly
- Comparing with other AI coding assistants
- Contributing to or modifying the plugin

## Related Information

- Agent: [[freebuff-delegate]]
- Plugin file: `.opencode/plugins/freebuff.mjs`
- Configuration: `opencode.json`
- Alternative memory: `.opencode/memories/freebuff-plugin-architecture.md`

## References

- Codebuff SDK: `@codebuff/sdk`
- Credentials path: `~/.config/manicode/credentials.json`
- Agent model: `z-ai/glm-5.1`
- Agent ID: `base2-free`
