#!/usr/bin/env bash
# Claude Code status line
# Input: JSON via stdin from Claude Code

input=$(cat)

# --- Extract fields ---
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
total_duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // empty')
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')

# Effort: prefer the payload; fall back to env, then settings (most specific first)
effort=$(echo "$input" | jq -r '(.effort | if type == "object" then .level else . end) // .effort_level // empty' 2>/dev/null)
[ -z "$effort" ] && effort="${CLAUDE_CODE_EFFORT_LEVEL:-}"
if [ -z "$effort" ]; then
  project_dir=$(echo "$input" | jq -r '.workspace.project_dir // .cwd // empty')
  for f in "$project_dir/.claude/settings.local.json" "$project_dir/.claude/settings.json" "$HOME/.claude/settings.json"; do
    [ -r "$f" ] || continue
    effort=$(jq -r '.effortLevel // empty' "$f" 2>/dev/null)
    [ -n "$effort" ] && break
  done
fi

# Rate limits
five_hr=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
seven_day=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
five_hr_resets=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_day_resets=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# Prompt cache (absent until the main conversation's first API response)
read -r cache_present cache_ttl cache_warm cache_expires cache_hit cache_misses <<< "$(echo "$input" | jq -r '
  .prompt_cache as $c
  | if $c == null then "0 - - - - -"
    else "1 \($c.ttl // "-") \($c.warm // false) \($c.expires_at // "-") \($c.hit_ratio // "-") \($c.misses // 0)"
    end' 2>/dev/null || echo "0 - - - - -")"

# --- Directory name ---
dir_name=""
if [ -n "$cwd" ]; then
  dir_name=$(basename "$cwd")
fi

# --- Git branch ---
branch=""
if [ -n "$cwd" ]; then
  if git_branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
    branch="$git_branch"
  elif git_branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
    branch="$git_branch"
  fi
fi

# --- Context window progress bar (10 chars wide) ---
# Default to 0% when conversation has just started (used_percentage is null)
if [ -z "$used_pct" ]; then
  used_pct="0"
fi
used_int=$(printf '%.0f' "$used_pct")
filled=$(echo "$used_pct" | awk '{printf "%d", ($1/100)*10 + 0.5}')
# Clamp to the bar width. BSD seq counts down when the end is below the start,
# so a negative or zero count must never reach the loops below.
[ "$filled" -gt 10 ] && filled=10
[ "$filled" -lt 0 ] && filled=0
empty=$((10 - filled))

# Color: green <50%, yellow 50-80%, red >80%
if [ "$used_int" -ge 80 ]; then
  bar_color='\033[31m'  # red
elif [ "$used_int" -ge 50 ]; then
  bar_color='\033[33m'  # yellow
else
  bar_color='\033[32m'  # green
fi

# Build bar: filled = solid blocks, empty = light shade
bar=""
i=0; while [ "$i" -lt "$filled" ]; do bar="${bar}█"; i=$((i + 1)); done
i=0; while [ "$i" -lt "$empty" ];  do bar="${bar}░"; i=$((i + 1)); done

# --- Session cost from built-in field ---
cost=$(printf '$%.2f' "${total_cost_usd:-0}")

# --- Session duration from built-in field ---
elapsed_s=$(echo "${total_duration_ms:-0}" | awk '{printf "%d", $1/1000}')
hrs=$(( elapsed_s / 3600 ))
mins=$(( (elapsed_s % 3600) / 60 ))
secs=$(( elapsed_s % 60 ))
if [ "$hrs" -gt 0 ]; then
  duration="${hrs}h ${mins}m"
else
  duration="${mins}m ${secs}s"
fi

# --- Helper: format epoch seconds ---
# BSD date (macOS) takes -r <epoch>. GNU date (Linux, Git Bash) reads -r as a
# file path, so fall back to -d @<epoch>.
fmt_epoch() {
  date -r "$1" "$2" 2>/dev/null || date -d "@$1" "$2" 2>/dev/null
}

# --- Helper: format token counts compactly ---
format_tokens() {
  local val="$1"
  if [ -z "$val" ] || [ "$val" = "0" ]; then
    echo "0"
  elif awk "BEGIN {exit !($val >= 1000000)}"; then
    awk "BEGIN {printf \"%.1fM\", $val/1000000}"
  elif awk "BEGIN {exit !($val >= 1000)}"; then
    awk "BEGIN {printf \"%.1fk\", $val/1000}"
  else
    echo "$val"
  fi
}

# --- Helper: cumulative session tokens from the transcript ---
# The status line payload has no cumulative token field. context_window.* holds
# only the live context and the most recent response, so it cannot accumulate.
# Sum every API response in the transcript instead. One assistant message is
# written once per content block, so the same usage object repeats: dedupe on
# message.id or the totals are inflated. Streams the file; never slurps it.
cum_tokens() {
  if [ -z "$transcript_path" ] || [ ! -r "$transcript_path" ]; then
    echo "0 0"
    return
  fi
  jq -n -r 'reduce (inputs | select(.message.usage != null)) as $e ({seen:{}, i:0, o:0};
    if .seen[$e.message.id] then . else
      .seen[$e.message.id] = true
      | .i += ($e.message.usage | (.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))
      | .o += ($e.message.usage.output_tokens // 0)
    end) | "\(.i) \(.o)"' "$transcript_path" 2>/dev/null || echo "0 0"
}

# --- Helper: color for rate limit percentage ---
rl_colored() {
  local val="$1" label="$2"
  local int_val color
  int_val=$(printf '%.0f' "$val")
  if [ "$int_val" -ge 80 ]; then
    color='\033[31m'  # red
  elif [ "$int_val" -ge 50 ]; then
    color='\033[33m'  # yellow
  else
    color='\033[32m'  # green
  fi
  printf "${color}${label}:${int_val}%%\033[0m"
}

# ======= LINE 1: [Model] =======

if [ -n "$model" ]; then
  short_model=$(echo "$model" | sed -E 's/^Claude[[:space:]]+([0-9.]+[[:space:]]+)?//')
  printf '\033[1;36m[%s]\033[0m' "$short_model"
fi

if [ -n "$effort" ]; then
  printf '  \033[2m|\033[0m  🧠 \033[35m%s\033[0m' "$effort"
fi

printf '\n'

# ======= LINE 2: 📁 dir  |  🌿 branch =======

if [ -n "$dir_name" ]; then
  printf '📁 %s' "$dir_name"
fi

if [ -n "$branch" ]; then
  printf '  \033[2m|\033[0m  🌿 \033[33m%s\033[0m' "$branch"
fi

printf '\n'

# ======= LINE 3: progress bar  % | tokens =======

# Context bar (always shown; defaults to 0% at conversation start)
printf "${bar_color}%s\033[0m \033[33m%s%%\033[0m" "$bar" "$used_int"

# Cumulative session token usage (always shown, defaults to 0)
read -r cum_in cum_out <<< "$(cum_tokens)"
in_fmt=$(format_tokens "${cum_in:-0}")
out_fmt=$(format_tokens "${cum_out:-0}")
printf '  \033[2m|\033[0m  \033[36m%s ↑ / %s ↓\033[0m' "$in_fmt" "$out_fmt"

printf '\n'

# ======= LINE 4: $cost | 🕐 duration | 5h 7d =======

# Cost (always shown)
printf '\033[32m%s\033[0m' "$cost"

# Duration (always shown)
printf '  \033[2m|\033[0m  '
printf '🕐 %s' "$duration"

# Rate limits (always shown, default to 0 if not yet available)
printf '  \033[2m|\033[0m  '
rl_colored "${five_hr:-0}" "5h"
printf ' '
rl_colored "${seven_day:-0}" "7d"

printf '\n'

# ======= LINE 5: prompt cache TTL / warm | hit ratio | misses =======

if [ "$cache_present" = "1" ]; then
  printf '💾 %s cache' "$cache_ttl"
  if [ "$cache_warm" = "true" ]; then
    expires_str=$(fmt_epoch "$cache_expires" '+%H:%M' 2>/dev/null || echo "--:--")
    printf ' \033[2m·\033[0m \033[32mwarm\033[0m \033[2muntil\033[0m \033[36m%s\033[0m' "$expires_str"
  else
    printf ' \033[2m·\033[0m \033[31mcold\033[0m'
  fi

  # Hit ratio: green >=80%, yellow 50-80%, red <50% (higher is better)
  if [ "$cache_hit" != "-" ]; then
    hit_int=$(awk "BEGIN {printf \"%d\", $cache_hit * 100 + 0.5}")
    if [ "$hit_int" -ge 80 ]; then
      hit_color='\033[32m'
    elif [ "$hit_int" -ge 50 ]; then
      hit_color='\033[33m'
    else
      hit_color='\033[31m'
    fi
    printf '  \033[2m|\033[0m  hit %b%s%%\033[0m' "$hit_color" "$hit_int"
  fi

  if [ "$cache_misses" = "0" ]; then
    printf '  \033[2m|\033[0m  \033[32m0 misses\033[0m'
  elif [ "$cache_misses" = "1" ]; then
    printf '  \033[2m|\033[0m  \033[33m1 miss\033[0m'
  else
    printf '  \033[2m|\033[0m  \033[33m%s misses\033[0m' "$cache_misses"
  fi
else
  printf '\033[2m💾 cache --\033[0m'
fi

printf '\n'

# ======= LINE 6: session reset times =======

five_hr_reset_str="--:--"
if [ -n "$five_hr_resets" ]; then
  five_hr_reset_str=$(fmt_epoch "$five_hr_resets" '+%H:%M' 2>/dev/null || echo "--:--")
fi

seven_day_reset_str="--- --:--"
if [ -n "$seven_day_resets" ]; then
  seven_day_reset_str=$(fmt_epoch "$seven_day_resets" '+%a %H:%M' 2>/dev/null || echo "--- --:--")
fi

printf '\033[2m⏰\033[0m'
printf ' \033[2m5h resets\033[0m \033[36m%s\033[0m' "$five_hr_reset_str"
printf '  \033[2m|\033[0m  \033[2m7d resets\033[0m \033[36m%s\033[0m' "$seven_day_reset_str"

printf '\n\n'
 