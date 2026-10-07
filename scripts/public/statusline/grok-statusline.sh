#!/usr/bin/env bash
# Grok status line
# Input: JSON via stdin from Grok. Grok shows at most five lines.

input=$(cat)

# --- Extract fields ---
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
total_duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // empty')
branch=$(echo "$input" | jq -r '.workspace.branch // empty')
cum_in=$(echo "$input" | jq -r '.context_window.session_input_tokens // 0')
cum_out=$(echo "$input" | jq -r '.context_window.session_output_tokens // 0')
trigger=$(echo "$input" | jq -r '.trigger // "state"')
effort=$(echo "$input" | jq -r '.effort.level // empty')

# Prompt cache: Grok sends only cumulative session totals (absent before the
# first call), so there is no TTL, warm/cold state or miss count to show
read -r cache_read cache_total <<< "$(echo "$input" | jq -r '
  .context_window.session_usage as $u
  | if $u == null then "- -"
    else "\($u.cache_read_input_tokens // 0) \(($u.input_tokens // 0) + ($u.cache_creation_input_tokens // 0) + ($u.cache_read_input_tokens // 0))"
    end' 2>/dev/null || echo "- -")"

# --- Directory name ---
dir_name=""
if [ -n "$cwd" ]; then
  dir_name=$(basename "$cwd")
fi

# --- Git branch (payload omits this on a detached HEAD) ---
if [ -z "$branch" ] && [ -n "$cwd" ]; then
  if git_branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null); then
    branch="$git_branch"
  elif git_branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$cwd" rev-parse --short HEAD 2>/dev/null); then
    branch="$git_branch"
  fi
fi

# --- Context window progress bar (10 chars wide) ---
# Default to 0% when the percentage is omitted (conversation just started)
if [ -z "$used_pct" ]; then
  used_pct="0"
fi
used_int=$(printf '%.0f' "$used_pct")
filled=$(echo "$used_pct" | awk '{printf "%d", ($1/100)*10 + 0.5}')
[ "$filled" -gt 10 ] && filled=10
[ "$filled" -lt 0 ] && filled=0
empty=$((10 - filled))

if [ "$used_int" -ge 80 ]; then
  bar_color='\033[31m'
elif [ "$used_int" -ge 50 ]; then
  bar_color='\033[33m'
else
  bar_color='\033[32m'
fi

bar=""
i=0; while [ "$i" -lt "$filled" ]; do bar="${bar}█"; i=$((i + 1)); done
i=0; while [ "$i" -lt "$empty" ];  do bar="${bar}░"; i=$((i + 1)); done

# --- Session cost (absent until something is billed) ---
if [ -n "$total_cost_usd" ]; then
  cost=$(printf '$%.2f' "$total_cost_usd")
else
  cost='--'
fi

# --- Session duration ---
elapsed_s=$(echo "${total_duration_ms:-0}" | awk '{printf "%d", $1/1000}')
hrs=$(( elapsed_s / 3600 ))
mins=$(( (elapsed_s % 3600) / 60 ))
secs=$(( elapsed_s % 60 ))
if [ "$hrs" -gt 0 ]; then
  duration="${hrs}h ${mins}m"
else
  duration="${mins}m ${secs}s"
fi

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

# Weekly plan reset from the last billing log line. Grok does not send
# rate_limits on stdin, and the billing payload has no used percent.
grok_home="${GROK_HOME:-$HOME/.grok}"
billing_log="${grok_home}/logs/unified.jsonl"
billing_cache="${grok_home}/statusline-billing.cache"
weekly_end=""
weekly_tier=""

cache_age=99999
if [ -f "$billing_cache" ]; then
  cache_age=$(( $(date +%s) - $(date -r "$billing_cache" +%s) ))
fi

if [ "$trigger" = "refresh_interval" ] || [ "$cache_age" -ge 60 ] || [ ! -f "$billing_cache" ]; then
  if [ -r "$billing_log" ]; then
    last_billing=$(tail -c 524288 "$billing_log" | grep 'billing: fetched credits config' | tail -1)
    if [ -n "$last_billing" ]; then
      printf '%s\n' "$last_billing" > "$billing_cache"
    fi
  fi
fi

if [ -r "$billing_cache" ]; then
  weekly_end=$(jq -r '.ctx.config.currentPeriod.end // empty' "$billing_cache" 2>/dev/null)
  weekly_tier=$(jq -r '.ctx.subscriptionTier // empty' "$billing_cache" 2>/dev/null)
fi

weekly_reset_abs=""
weekly_reset_in=""
if [ -n "$weekly_end" ]; then
  eval "$(python3 - "$weekly_end" <<'PY'
from datetime import datetime, timezone
import shlex
import sys
raw = sys.argv[1]
try:
    end = datetime.fromisoformat(raw)
except ValueError:
    sys.exit(0)
if end.tzinfo is None:
    end = end.replace(tzinfo=timezone.utc)
now = datetime.now(timezone.utc)
delta = end - now
print("weekly_reset_abs=" + shlex.quote(end.astimezone().strftime("%a %H:%M")))
secs = int(delta.total_seconds())
if secs <= 0:
    print("weekly_reset_in=due")
else:
    days, rem = divmod(secs, 86400)
    hours, rem = divmod(rem, 3600)
    mins = rem // 60
    if days:
        text = f"{days}d {hours}h"
    elif hours:
        text = f"{hours}h {mins}m"
    else:
        text = f"{mins}m"
    print("weekly_reset_in=" + shlex.quote(text))
PY
)"
fi

# ======= LINE 1: [Model] =======

if [ -n "$model" ]; then
  printf '%b' "\033[1;36m[${model}]\033[0m"
fi

if [ -n "$effort" ]; then
  printf '%b' "  \033[2m|\033[0m  🧠 \033[35m${effort}\033[0m"
fi

printf '\n'

# ======= LINE 2: dir | branch =======

if [ -n "$dir_name" ]; then
  printf '📁 %s' "$dir_name"
fi

if [ -n "$branch" ]; then
  printf '%b' "  \033[2m|\033[0m  🌿 \033[33m${branch}\033[0m"
fi

printf '\n'

# ======= LINE 3: progress bar  % | tokens | $cost | duration =======
# Grok shows at most five lines, so cost and duration share this one

printf '%b' "${bar_color}${bar}\033[0m \033[33m${used_int}%\033[0m"

in_fmt=$(format_tokens "${cum_in:-0}")
out_fmt=$(format_tokens "${cum_out:-0}")
printf '%b' "  \033[2m|\033[0m  \033[36m${in_fmt} ↑ / ${out_fmt} ↓\033[0m"

printf '%b' "  \033[2m|\033[0m  "
printf '%b' "\033[32m${cost}\033[0m"
printf '%b' "  \033[2m|\033[0m  "
printf '🕐 %s' "$duration"

printf '\n'

# ======= LINE 4: prompt cache hit ratio | cached tokens =======

if [ "$cache_total" != "-" ] && [ "$cache_total" -gt 0 ]; then
  # Hit ratio: green >=80%, yellow 50-80%, red <50% (higher is better)
  hit_int=$(awk "BEGIN {printf \"%d\", $cache_read * 100 / $cache_total + 0.5}")
  if [ "$hit_int" -ge 80 ]; then
    hit_color='\033[32m'
  elif [ "$hit_int" -ge 50 ]; then
    hit_color='\033[33m'
  else
    hit_color='\033[31m'
  fi
  printf '%b' "💾 cache hit ${hit_color}${hit_int}%\033[0m"
  printf '%b' "  \033[2m|\033[0m  \033[36m$(format_tokens "$cache_read") cached\033[0m"
else
  printf '%b' "\033[2m💾 cache --\033[0m"
fi

printf '\n'

# ======= LINE 5: weekly reset (no used % — Grok does not publish one here) =======

if [ -n "$weekly_reset_abs" ]; then
  printf '%b' "\033[2m⏰\033[0m"
  if [ -n "$weekly_tier" ]; then
    printf ' \033[2m%s\033[0m' "$weekly_tier"
    printf '%b' "  \033[2m|\033[0m "
  fi
  printf '%b' " \033[2mweekly resets\033[0m \033[36m${weekly_reset_abs}\033[0m"
  if [ -n "$weekly_reset_in" ]; then
    printf '%b' "  \033[2m|\033[0m  \033[36min ${weekly_reset_in}\033[0m"
  fi
  printf '\n'
fi
