#!/usr/bin/env node
// Claude Code status line
// Input: JSON via stdin from Claude Code

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
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

// Effort: prefer the payload; fall back to env, then settings (most specific first)
const resolveEffort = (input) => {
  const fromPayload =
    (input.effort && typeof input.effort === 'object' ? input.effort.level : input.effort) ||
    input.effort_level;
  if (fromPayload) return fromPayload;
  if (process.env.CLAUDE_CODE_EFFORT_LEVEL) return process.env.CLAUDE_CODE_EFFORT_LEVEL;

  const projectDir = input.workspace?.project_dir || input.cwd || '';
  const candidates = [
    path.join(projectDir, '.claude', 'settings.local.json'),
    path.join(projectDir, '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude', 'settings.json'),
  ];
  for (const file of candidates) {
    try {
      const effort = JSON.parse(fs.readFileSync(file, 'utf8')).effortLevel;
      if (effort) return effort;
    } catch {
      // unreadable or missing settings file
    }
  }
  return '';
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

// Timestamps arrive as epoch seconds
const toDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = isNaN(Number(value)) ? new Date(value) : new Date(Number(value) * 1000);
  return isNaN(date.getTime()) ? null : date;
};

const pad = (n) => String(n).padStart(2, '0');
const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatDayTime = (date) =>
  `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${formatTime(date)}`;

// The status line payload has no cumulative token field. context_window.* holds
// only the live context and the most recent response, so it cannot accumulate.
// Sum every API response in the transcript instead. One assistant message is
// written once per content block, so the same usage object repeats: dedupe on
// message.id or the totals are inflated. Streams the file; never slurps it.
const cumulativeTokens = async (transcriptPath) => {
  const totals = { input: 0, output: 0 };
  if (!transcriptPath) return totals;
  try {
    fs.accessSync(transcriptPath, fs.constants.R_OK);
  } catch {
    return totals;
  }

  const seen = new Set();
  const lines = readline.createInterface({
    input: fs.createReadStream(transcriptPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.includes('"usage"')) continue;
    const message = parseJson(line).message;
    const usage = message?.usage;
    if (!usage || seen.has(message.id)) continue;
    seen.add(message.id);
    totals.input +=
      (usage.input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.cache_read_input_tokens || 0);
    totals.output += usage.output_tokens || 0;
  }
  return totals;
};

const rateLimit = (value, label) => {
  const pct = Math.round(Number(value) || 0);
  return `${usageColor(pct)}${label}:${pct}%${RESET}`;
};

const cacheLine = (cache) => {
  if (!cache) return `${DIM}💾 cache --${RESET}`;

  let line = `💾 ${cache.ttl ?? '-'} cache`;
  if (cache.warm) {
    const expires = toDate(cache.expires_at);
    line += ` ${DIM}·${RESET} ${GREEN}warm${RESET} ${DIM}until${RESET} ${CYAN}${expires ? formatTime(expires) : '--:--'}${RESET}`;
  } else {
    line += ` ${DIM}·${RESET} ${RED}cold${RESET}`;
  }

  // Higher is better: red below 50, yellow below 80, green at or above 80
  if (cache.hit_ratio !== undefined && cache.hit_ratio !== null) {
    const hit = Math.round(cache.hit_ratio * 100);
    const hitColor = hit >= 80 ? GREEN : hit >= 50 ? YELLOW : RED;
    line += `${SEP}hit ${hitColor}${hit}%${RESET}`;
  }

  const misses = cache.misses || 0;
  if (misses === 0) line += `${SEP}${GREEN}0 misses${RESET}`;
  else if (misses === 1) line += `${SEP}${YELLOW}1 miss${RESET}`;
  else line += `${SEP}${YELLOW}${misses} misses${RESET}`;
  return line;
};

const main = async () => {
  const input = parseJson(await readStdin());
  const cwd = input.cwd || input.workspace?.current_dir || '';
  const model = input.model?.display_name || '';
  const effort = resolveEffort(input);
  const branch = gitBranch(cwd);
  const fiveHour = input.rate_limits?.five_hour;
  const sevenDay = input.rate_limits?.seven_day;
  const lines = [];

  // Line 1: [Model] | effort
  let line1 = '';
  if (model) line1 += `${BOLD_CYAN}[${model.replace(/^Claude\s+(?:[\d.]+\s+)?/, '')}]${RESET}`;
  if (effort) line1 += `${SEP}🧠 ${MAGENTA}${effort}${RESET}`;
  lines.push(line1);

  // Line 2: dir | branch
  let line2 = '';
  if (cwd) line2 += `📁 ${path.basename(cwd)}`;
  if (branch) line2 += `${SEP}🌿 ${YELLOW}${branch}${RESET}`;
  lines.push(line2);

  // Line 3: context bar (0% until the first response) | cumulative tokens
  const usedPct = Number(input.context_window?.used_percentage) || 0;
  const usedInt = Math.round(usedPct);
  const filled = Math.min(10, Math.max(0, Math.round(usedPct / 10)));
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const tokens = await cumulativeTokens(input.transcript_path);
  lines.push(
    `${usageColor(usedInt)}${bar}${RESET} ${YELLOW}${usedInt}%${RESET}` +
      `${SEP}${CYAN}${formatTokens(tokens.input)} ↑ / ${formatTokens(tokens.output)} ↓${RESET}`,
  );

  // Line 4: cost | duration | rate limits
  const cost = `$${(Number(input.cost?.total_cost_usd) || 0).toFixed(2)}`;
  lines.push(
    `${GREEN}${cost}${RESET}${SEP}🕐 ${formatDuration(input.cost?.total_duration_ms)}` +
      `${SEP}${rateLimit(fiveHour?.used_percentage, '5h')} ${rateLimit(sevenDay?.used_percentage, '7d')}`,
  );

  // Line 5: prompt cache (absent until the main conversation's first API response)
  lines.push(cacheLine(input.prompt_cache));

  // Line 6: rate limit reset times
  const fiveHourReset = toDate(fiveHour?.resets_at);
  const sevenDayReset = toDate(sevenDay?.resets_at);
  lines.push(
    `${DIM}⏰${RESET} ${DIM}5h resets${RESET} ${CYAN}${fiveHourReset ? formatTime(fiveHourReset) : '--:--'}${RESET}` +
      `${SEP}${DIM}7d resets${RESET} ${CYAN}${sevenDayReset ? formatDayTime(sevenDayReset) : '--- --:--'}${RESET}`,
  );

  process.stdout.write(`${lines.join('\n')}\n\n`);
};

main();
