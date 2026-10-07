#!/usr/bin/env node
// Grok status line
// Input: JSON via stdin from Grok. Grok shows at most five lines.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BOLD_CYAN = '\x1b[1;36m';
const SEP = `  ${DIM}|${RESET}  `;

const BILLING_MARKER = 'billing: fetched credits config';
const BILLING_LOG_TAIL_BYTES = 512 * 1024;
const BILLING_CACHE_MAX_AGE_MS = 60 * 1000;

const readStdin = () =>
  new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const gitBranch = (cwd) => {
  if (!cwd) return '';
  const git = (args) =>
    execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim();
  try {
    return git(['symbolic-ref', '--short', 'HEAD']);
  } catch {
    try {
      return git(['rev-parse', '--short', 'HEAD']);
    } catch {
      return '';
    }
  }
};

// Green below 50, yellow below 80, red at or above 80
const usageColor = (pct) => (pct >= 80 ? RED : pct >= 50 ? YELLOW : GREEN);

const formatTokens = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const formatDuration = (ms) => {
  const totalSecs = Math.floor((Number(ms) || 0) / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return 'due';
  const totalMins = Math.floor(ms / 60_000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const pad = (n) => String(n).padStart(2, '0');
const formatDayTime = (date) =>
  `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

// An ISO timestamp without an offset is UTC
const parseUtc = (iso) => {
  const hasOffset = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const date = new Date(hasOffset ? iso : `${iso}Z`);
  return isNaN(date.getTime()) ? null : date;
};

const readLogTail = (file) => {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const length = Math.min(size, BILLING_LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
};

// Grok sends no rate_limits on stdin, so the weekly plan reset comes from the
// last billing line in Grok's log. The billing payload has no used percent.
// The line is cached so a busy turn does not rescan the log on every run.
const weeklyPlan = (trigger) => {
  const grokHome = process.env.GROK_HOME || path.join(os.homedir(), '.grok');
  const billingLog = path.join(grokHome, 'logs', 'unified.jsonl');
  const billingCache = path.join(grokHome, 'statusline-billing.cache');

  let cacheAge = Infinity;
  try {
    cacheAge = Date.now() - fs.statSync(billingCache).mtimeMs;
  } catch {
    // no cache yet
  }

  if (trigger === 'refresh_interval' || cacheAge >= BILLING_CACHE_MAX_AGE_MS) {
    try {
      const lastBilling = readLogTail(billingLog)
        .split('\n')
        .filter((line) => line.includes(BILLING_MARKER))
        .pop();
      if (lastBilling) fs.writeFileSync(billingCache, `${lastBilling}\n`);
    } catch {
      // unreadable log; keep the previous cache
    }
  }

  let billing = {};
  try {
    billing = parseJson(fs.readFileSync(billingCache, 'utf8'));
  } catch {
    return null;
  }
  const end = billing.ctx?.config?.currentPeriod?.end;
  const resetsAt = end ? parseUtc(end) : null;
  if (!resetsAt) return null;
  return { resetsAt, tier: billing.ctx?.subscriptionTier || '' };
};

// Grok sends only cumulative session totals (absent before the first call),
// so there is no TTL, warm/cold state or miss count to show
const cacheLine = (usage) => {
  const read = usage?.cache_read_input_tokens || 0;
  const total = (usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) + read;
  if (!usage || total <= 0) return `${DIM}💾 cache --${RESET}`;

  // Higher is better: red below 50, yellow below 80, green at or above 80
  const hit = Math.round((read * 100) / total);
  const hitColor = hit >= 80 ? GREEN : hit >= 50 ? YELLOW : RED;
  return `💾 cache hit ${hitColor}${hit}%${RESET}${SEP}${CYAN}${formatTokens(read)} cached${RESET}`;
};

const main = async () => {
  const input = parseJson(await readStdin());
  const cwd = input.cwd || input.workspace?.current_dir || '';
  const model = input.model?.display_name || '';
  const effort = input.effort?.level || '';
  // The payload omits the branch on a detached HEAD
  const branch = input.workspace?.branch || gitBranch(cwd);
  const contextWindow = input.context_window || {};
  const lines = [];

  // Line 1: [Model] | effort
  let line1 = '';
  if (model) line1 += `${BOLD_CYAN}[${model}]${RESET}`;
  if (effort) line1 += `${SEP}🧠 ${MAGENTA}${effort}${RESET}`;
  lines.push(line1);

  // Line 2: dir | branch
  let line2 = '';
  if (cwd) line2 += `📁 ${path.basename(cwd)}`;
  if (branch) line2 += `${SEP}🌿 ${YELLOW}${branch}${RESET}`;
  lines.push(line2);

  // Line 3: context bar (0% until the first response) | session tokens | cost | duration
  const usedPct = Number(contextWindow.used_percentage) || 0;
  const usedInt = Math.round(usedPct);
  const filled = Math.min(10, Math.max(0, Math.round(usedPct / 10)));
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const tokensIn = formatTokens(contextWindow.session_input_tokens || 0);
  const tokensOut = formatTokens(contextWindow.session_output_tokens || 0);
  // Absent until something is billed
  const totalCost = input.cost?.total_cost_usd;
  const cost =
    totalCost === undefined || totalCost === null ? '--' : `$${Number(totalCost).toFixed(2)}`;
  lines.push(
    `${usageColor(usedInt)}${bar}${RESET} ${YELLOW}${usedInt}%${RESET}` +
      `${SEP}${CYAN}${tokensIn} ↑ / ${tokensOut} ↓${RESET}` +
      `${SEP}${GREEN}${cost}${RESET}${SEP}🕐 ${formatDuration(input.cost?.total_duration_ms)}`,
  );

  // Line 4: prompt cache hit ratio | cached tokens
  lines.push(cacheLine(contextWindow.session_usage));

  // Line 5: plan tier | weekly reset
  const plan = weeklyPlan(input.trigger || 'state');
  if (plan) {
    let line5 = `${DIM}⏰${RESET} `;
    if (plan.tier) line5 += `${DIM}${plan.tier}${RESET}${SEP}`;
    line5 += `${DIM}weekly resets${RESET} ${CYAN}${formatDayTime(plan.resetsAt)}${RESET}`;
    line5 += `${SEP}${CYAN}in ${formatCountdown(plan.resetsAt.getTime() - Date.now())}${RESET}`;
    lines.push(line5);
  }

  process.stdout.write(`${lines.join('\n')}\n`);
};

main();
