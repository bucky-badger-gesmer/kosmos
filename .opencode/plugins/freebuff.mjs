import { tool } from '@opencode-ai/plugin';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);

const CREDENTIALS_PATH = join(
  homedir(),
  '.config',
  'manicode',
  'credentials.json',
);

const RUN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Inline agent definition matching the server's free-mode allowlist.
 * Agent ID "base2-free" + model "z-ai/glm-5.1" = 0 credits in free mode.
 */
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
  instructionsPrompt: `You are a helpful coding assistant running in read-only advisory mode.
You can read files in the project to understand the codebase, but you CANNOT modify files or run commands directly.
Your job is to analyze code, answer questions, and provide actionable file changes as structured output.

When proposing file changes, use this exact format for EACH file:

### FILE: <absolute path>
### ACTION: create | replace
\`\`\`
<full file content or replacement content>
\`\`\`

For partial edits, use this format:

### FILE: <absolute path>
### ACTION: edit
### SEARCH:
\`\`\`
<exact existing text to find>
\`\`\`
### REPLACE:
\`\`\`
<replacement text>
\`\`\`

Always read the target file first before proposing edits.

IMPORTANT — Performance rules:
- When you need to read multiple files, read them ALL in a single read_files call (pass multiple paths).
- Use glob or list_directory first to find files, then batch-read the results.
- Do NOT read files one at a time — every tool call adds latency.
- Be concise and focused. Get the information you need in as few tool calls as possible.`,
};

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

let CodebuffClient = null;

async function loadSDK() {
  if (!CodebuffClient) {
    const sdk = await import('@codebuff/sdk');
    CodebuffClient = sdk.CodebuffClient;
  }
  return CodebuffClient;
}

export const server = async (ctx) => {
  return {
    tool: {
      freebuff: tool({
        description:
          'Delegate a task to freebuff, a free AI coding agent. ' +
          'IMPORTANT: Do NOT read files before calling this tool — freebuff can read files itself. ' +
          "Just pass the user's request directly as the prompt. Keep the prompt short and simple. " +
          'Do NOT paste file contents into the prompt. ' +
          'Freebuff returns structured file change proposals (FILE/ACTION/SEARCH/REPLACE markers). ' +
          'After calling freebuff, apply its proposed changes using your own write tools.',
        args: {
          prompt: tool.schema
            .string()
            .describe('The task, question, or instruction to send to freebuff'),
          cwd: tool.schema
            .string()
            .optional()
            .describe(
              'Working directory for freebuff. Defaults to the project directory.',
            ),
        },
        async execute(args) {
          const workingDir = args.cwd || ctx.directory || process.cwd();
          return runFreebuff(args.prompt, workingDir);
        },
      }),
    },
  };
};

async function runFreebuff(prompt, cwd) {
  const apiKey = getAuthToken();
  if (!apiKey) {
    throw new Error(
      'freebuff is not logged in. Run `freebuff login` in your terminal first.',
    );
  }

  const ClientClass = await loadSDK();

  const client = new ClientClass({
    apiKey,
    cwd,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

  try {
    let streamedText = '';

    const result = await client.run({
      agent: FREE_AGENT,
      prompt,
      costMode: 'free',
      signal: controller.signal,
      handleStreamChunk: (chunk) => {
        if (typeof chunk === 'string') {
          streamedText += chunk;
        } else if (
          typeof chunk === 'object' &&
          chunk.type === 'subagent_chunk'
        ) {
          streamedText += chunk.chunk;
        }
      },
    });

    clearTimeout(timeoutId);

    if (result.output?.type === 'error') {
      return `freebuff error: ${result.output.message}`;
    }

    const outputText =
      streamedText.trim() ||
      result.output?.message ||
      result.output?.text ||
      '(freebuff returned no output)';

    return outputText;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return 'freebuff timed out after 5 minutes.';
    }
    throw err;
  }
}
