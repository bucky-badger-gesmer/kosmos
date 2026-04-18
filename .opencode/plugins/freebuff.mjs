import { tool } from '@opencode-ai/plugin';
import { createRequire } from 'module';
import {
  readFileSync,
  existsSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);

const CREDENTIALS_PATH = join(
  homedir(),
  '.config',
  'manicode',
  'credentials.json',
);

const RUN_TIMEOUT_MS = 20 * 60 * 1000;
const OUTPUT_DIR = 'freebuff-output';

/**
 * Inline agent definition matching the server's free-mode allowlist.
 * Agent ID "base2-free" + model "z-ai/glm-5.1" = 0 credits in free mode.
 *
 * NOTE: The CLI's base2-free has sub-agents and context pruning we can't
 * replicate here, so we compensate with tighter instructions and maxAgentSteps.
 */
const FREE_AGENT = {
  id: 'base2-free',
  model: 'z-ai/glm-5.1',
  displayName: 'Freebuff (Free)',
  outputMode: 'all_messages',
  includeMessageHistory: true,
  providerOptions: {
    data_collection: 'deny',
  },
  toolNames: [
    'read_files',
    'read_subtree',
    'list_directory',
    'glob',
    'write_file',
    'str_replace',
    'apply_patch',
    'run_terminal_command',
  ],
  spawnableAgents: [],
  systemPrompt: `You are a helpful coding assistant running in free mode. You can read and write files and run terminal commands.

# Core Rules
- Understand first, act second: read relevant files BEFORE editing.
- Be concise and efficient — minimize tool calls and output length.
- When reading multiple files, read them ALL in a single read_files call.
- Use glob or list_directory to find files, then batch-read results.
- Prefer str_replace over write_file for targeted edits.
- When running terminal commands, use run_terminal_command directly.
- Keep responses short. Summarize results in a few bullet points.

# Code Editing
- Follow existing project conventions, style, and patterns.
- Make minimal changes to accomplish the task.
- Don't add imports, tests, or refactoring beyond what's asked.
- Always read a file before editing it.`,
  instructionsPrompt: `Complete the user's request efficiently:
1. If you need to find files, use glob/list_directory, then batch-read with read_files.
2. If you need to run commands, use run_terminal_command directly.
3. For code changes, read the target file first, then use str_replace for targeted edits or write_file for new files.
4. Report what you did concisely when finished.`,
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
          "CRITICAL PROMPT RULE: Copy the user's request word-for-word into the prompt parameter. " +
          'Do NOT add requirements, bullet points, elaboration, or context. Do NOT rewrite or "improve" the prompt. ' +
          'If the user wrote 10 words, pass exactly those 10 words. ' +
          'WRONG: user says "make a game" → you pass "Make a game with these requirements: - scoring - enemies - ...". ' +
          'CORRECT: user says "make a game" → you pass "make a game". ' +
          'Do NOT paste file contents into the prompt. ' +
          'Freebuff can read and write files directly in the project.',
        args: {
          prompt: tool.schema
            .string()
            .describe(
              "COPY the user's exact words here. Do NOT rewrite, expand, or add to the user's request.",
            ),
          cwd: tool.schema
            .string()
            .optional()
            .describe(
              'Working directory for freebuff. Defaults to the project directory.',
            ),
        },
        async execute(args, context) {
          const workingDir = args.cwd || ctx.directory || process.cwd();
          return runFreebuff(args.prompt, workingDir, context);
        },
      }),
    },
  };
};

async function runFreebuff(prompt, cwd, context) {
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
    let timedOut = false;

    const result = await client.run({
      agent: FREE_AGENT,
      prompt,
      costMode: 'free',
      maxAgentSteps: 50,
      signal: controller.signal,
      handleStreamChunk: (chunk) => {
        const text = typeof chunk === 'string' ? chunk : (chunk?.chunk ?? '');
        if (!text) return;
        streamedText += text;
        if (context?.metadata) {
          const lines = streamedText.trimEnd().split('\n').filter(Boolean);
          const lastLine = lines.pop() ?? '';
          context.metadata({
            title: lastLine.length > 80 ? lastLine.slice(-80) : lastLine,
            metadata: { output: streamedText },
          });
        }
      },
    });

    // Check if our timeout fired (the SDK swallows AbortError internally)
    timedOut = controller.signal.aborted;
    clearTimeout(timeoutId);

    if (result.output?.type === 'error') {
      const msg = result.output.message || '(unknown error)';
      // The SDK masks many errors as "cancelled by user" — add context
      if (timedOut) {
        return `freebuff timed out after ${RUN_TIMEOUT_MS / 60000} minutes. Partial output:\n${streamedText.trim() || '(none)'}`;
      }
      if (/cancel/i.test(msg)) {
        return `freebuff run failed (reported as "${msg}"). This usually means a network error, auth issue, or server-side timeout — not an actual user cancellation. Streamed output so far:\n${streamedText.trim() || '(none)'}`;
      }
      return `freebuff error: ${msg}`;
    }

    let finalOutput = '';

    if (streamedText.trim()) {
      finalOutput = streamedText.trim();
    } else {
      const out = result.output;
      if (out?.type === 'structuredOutput') {
        finalOutput = out.value != null ? JSON.stringify(out.value) : '';
      } else if (out?.type === 'lastMessage' || out?.type === 'allMessages') {
        const messages = out.value ?? [];
        finalOutput = messages
          .flatMap((m) => (Array.isArray(m.content) ? m.content : [m.content]))
          .filter((c) => c?.type === 'text' || typeof c === 'string')
          .map((c) => (typeof c === 'string' ? c : c.text))
          .join('\n')
          .trim();
      }
    }

    if (!finalOutput) {
      return '(freebuff returned no output)';
    }

    // Write full output to file so it's always accessible
    const outputDir = join(cwd, OUTPUT_DIR);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 16);
    const outputFile = join(outputDir, `${date}.md`);
    const relativeFile = join(OUTPUT_DIR, `${date}.md`);
    try {
      mkdirSync(outputDir, { recursive: true });
      const entry = `## ${time} — ${prompt}\n\n${finalOutput}\n\n---\n\n`;
      if (!existsSync(outputFile)) {
        writeFileSync(
          outputFile,
          `# Freebuff Logs — ${date}\n\n---\n\n${entry}`,
        );
      } else {
        appendFileSync(outputFile, entry);
      }
    } catch {
      // Non-fatal — still return the output
    }

    return `${finalOutput}\n\n---\nFull output saved to ${relativeFile}`;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return `freebuff timed out after ${RUN_TIMEOUT_MS / 60000} minutes.`;
    }
    return `freebuff error: ${err.message || err}`;
  }
}
