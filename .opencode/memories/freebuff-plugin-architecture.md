# Freebuff Plugin Architecture

## Overview

The freebuff plugin is an OpenCode plugin that integrates with the Codebuff SDK to provide a free AI coding agent. It operates in read-only advisory mode and returns structured file change proposals.

---

## Configuration

### Plugin Registration (`opencode.json`)

```json
{
  "plugin": [".opencode/plugins/freebuff.mjs"]
}
```

The plugin is registered in `opencode.json` and loaded automatically by OpenCode.

---

## Auth Flow

### 1. Credential Storage

Credentials are stored in a local JSON file:

**Path**: `~/.config/manicode/credentials.json`

```javascript
const CREDENTIALS_PATH = join(
  homedir(),
  '.config',
  'manicode',
  'credentials.json',
);
```

### 2. Token Extraction

The plugin reads the `authToken` from the default profile:

```javascript
function getAuthToken() {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
    return creds?.default?.authToken ?? null;
  } catch {
    return null;
  }
}
```

### 3. Authentication Check

If no auth token is found, the plugin throws an error:

```javascript
if (!apiKey) {
  throw new Error(
    'freebuff is not logged in. Run `freebuff login` in your terminal first.',
  );
}
```

**Note**: Users must run `freebuff login` in their terminal before using the plugin.

---

## Agent Configuration

The plugin defines a hardcoded `FREE_AGENT` object that configures the agent behavior:

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
  instructionsPrompt: `...`, // Read-only advisory mode instructions
};
```

### Key Configuration Details

| Property                | Value          | Purpose                            |
| ----------------------- | -------------- | ---------------------------------- |
| `id`                    | `base2-free`   | Unique agent identifier            |
| `model`                 | `z-ai/glm-5.1` | AI model to use                    |
| `costMode`              | `free`         | Billing mode (0 credits)           |
| `outputMode`            | `last_message` | Return only the final response     |
| `includeMessageHistory` | `false`        | Don't include conversation history |
| `data_collection`       | `deny`         | Opt out of data collection         |

### Tool Capabilities

The agent has access to these read-only tools:

- `read_files` - Read one or multiple files
- `read_subtree` - Read directory contents recursively
- `list_directory` - List files in a directory
- `glob` - Find files by pattern
- `set_output` - Set structured output
- `suggest_followups` - Suggest follow-up actions

### Read-Only Mode

The `instructionsPrompt` explicitly restricts the agent:

- **Cannot modify files** - Only reads and analyzes
- **Cannot run commands** - No shell execution
- **Returns structured proposals** - Uses FILE/ACTION/SEARCH/REPLACE format
- **Performance optimized** - Batches file reads, minimizes tool calls

---

## SDK Communication

### 1. SDK Loading

The plugin lazy-loads the Codebuff SDK:

```javascript
async function loadSDK() {
  if (!CodebuffClient) {
    const sdk = await import('@codebuff/sdk');
    CodebuffClient = sdk.CodebuffClient;
  }
  return CodebuffClient;
}
```

### 2. Client Initialization

```javascript
const ClientClass = await loadSDK();
const client = new ClientClass({
  apiKey, // From credentials.json
  cwd, // Working directory
});
```

### 3. Task Execution

```javascript
const result = await client.run({
  agent: FREE_AGENT, // Agent configuration
  prompt, // User's task
  costMode: 'free', // Free tier billing
  signal: controller.signal, // Abort signal for timeout
  handleStreamChunk: (chunk) => {
    // Accumulate streamed text
  },
});
```

### 4. Timeout Handling

A 5-minute timeout is enforced:

```javascript
const RUN_TIMEOUT_MS = 5 * 60 * 1000;
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
```

### 5. Streaming Response

The SDK streams results chunk by chunk:

```javascript
handleStreamChunk: (chunk) => {
  if (typeof chunk === 'string') {
    streamedText += chunk;
  } else if (typeof chunk === 'object' && chunk.type === 'subagent_chunk') {
    streamedText += chunk.chunk;
  }
};
```

### 6. Result Processing

After streaming completes, the plugin checks for errors and extracts output:

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

---

## Plugin Interface

### Tool Definition

The plugin exports a `server` function that registers the `freebuff` tool:

```javascript
export const server = async (ctx) => {
  return {
    tool: {
      freebuff: tool({
        description: 'Delegate a task to freebuff...',
        args: {
          prompt: tool.schema.string(),
          cwd: tool.schema.string().optional(),
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

### Usage in OpenCode

```javascript
freebuff({
  prompt: 'Analyze this codebase structure',
  cwd: '/path/to/project', // Optional, defaults to project directory
});
```

---

## Delegation Agent

A companion agent (`freebuff-delegate`) provides guidance for using the tool:

- **Location**: `.opencode/agents/freebuff-delegate.md`
- **Purpose**: Delegation layer between user and freebuff
- **Best Practices**:
  - Don't read files before calling freebuff
  - Keep prompts short and direct
  - Don't paste file contents into prompts
  - Use for second opinions and subtask offloading

---

## End-to-End Data Flow

```
User calls freebuff tool
  ↓
Plugin reads authToken from ~/.config/manicode/credentials.json
  ↓
Lazy-load @codebuff/sdk and create CodebuffClient
  ↓
client.run({ agent: FREE_AGENT, costMode: "free" })
  ↓
SDK sends request to codebuff server with:
  - API key (authToken)
  - Agent config (base2-free + z-ai/glm-5.1)
  - Billing mode (free)
  ↓
Server validates (free tier allowlist)
  ↓
Agent executes with read-only tools
  ↓
Results stream back via handleStreamChunk
  ↓
Plugin accumulates chunks and returns output text
```

---

## Key Design Decisions

1. **Read-only mode**: The agent cannot modify files or run commands, ensuring safety
2. **Structured output**: Uses FILE/ACTION/SEARCH/REPLACE markers for change proposals
3. **Lazy loading**: SDK is only loaded when the tool is actually called
4. **Streaming**: Results stream in real-time for better UX
5. **Free tier**: Hardcoded agent config ensures 0-credit usage
6. **External auth**: Credentials managed separately by `freebuff login` CLI
