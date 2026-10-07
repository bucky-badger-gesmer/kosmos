# Status line templates

Opt-in status lines for Claude Code and Grok. Copy them into your global config. They then show in every project.

Each tool has a Node script and a Bash script. Both give the same output. Pick one.

| Variant | Needs                                    | Platforms                                            |
| ------- | ---------------------------------------- | ---------------------------------------------------- |
| Node    | Node only                                | macOS, Linux, Windows                                |
| Bash    | `bash`, `jq`; Grok also needs `python3` | macOS, Linux; Windows only with Git Bash and `jq` |

| File                   | Copy to                              |
| ---------------------- | ------------------------------------ |
| `claude-statusline.js` | `~/.claude/statusline.js`            |
| `claude-statusline.sh` | `~/.claude/statusline.sh`            |
| `grok-statusline.js`   | `~/.grok/statusline.js`              |
| `grok-statusline.sh`   | `~/.grok/statusline.sh`              |

## What they show

**Claude Code** (6 lines): model and effort, directory and branch, context bar and session tokens, cost, duration and 5h/7d rate limits, prompt cache state, rate limit reset times.

**Grok** (5 lines, the Grok maximum): model and effort, directory and branch, context bar with session tokens, cost and duration, prompt cache hit ratio, plan tier and weekly reset. Grok sends no rate limits, so the weekly reset comes from Grok's billing log.

## Install

Run these commands from the maestro root.

### Node: macOS and Linux

```bash
cp scripts/public/statusline/claude-statusline.js ~/.claude/statusline.js
cp scripts/public/statusline/grok-statusline.js ~/.grok/statusline.js
```

### Node: Windows (PowerShell)

```powershell
Copy-Item scripts/public/statusline/claude-statusline.js ~/.claude/statusline.js
Copy-Item scripts/public/statusline/grok-statusline.js ~/.grok/statusline.js
```

### Bash

```bash
cp scripts/public/statusline/claude-statusline.sh ~/.claude/statusline.sh
cp scripts/public/statusline/grok-statusline.sh ~/.grok/statusline.sh
chmod +x ~/.claude/statusline.sh ~/.grok/statusline.sh
```

### Config

1. Add this block to `~/.claude/settings.json`. If a `statusLine` key exists, replace it.

   ```json
   "statusLine": {
     "type": "command",
     "command": "node ~/.claude/statusline.js"
   }
   ```

2. Add this table to `~/.grok/config.toml`. If a `[ui.status_line]` table exists, replace it.

   ```toml
   [ui.status_line]
   type = "command"
   command = "node ~/.grok/statusline.js"
   refresh_interval = 300
   ```

3. For the Bash variant, change each `command` value:

   | Tool   | Node (default)                | Bash                          |
   | ------ | ----------------------------- | ----------------------------- |
   | Claude | `node ~/.claude/statusline.js` | `bash ~/.claude/statusline.sh` |
   | Grok   | `node ~/.grok/statusline.js`   | `bash ~/.grok/statusline.sh`   |

4. Restart Claude Code and Grok.

## Why global, not project

- **Claude Code:** project settings override user settings. A project `statusLine` replaces the status line each person already has.
- **Grok:** a repo cannot set a command status line. Grok reads `[ui.status_line]` only from `~/.grok/config.toml`.

## Update

The copies do not update themselves. Copy the scripts again after a change here. Change the Node and Bash variants together, and keep their output identical.

## Test

Pipe a sample payload into a script:

```bash
echo '{"cwd":"'"$PWD"'","model":{"display_name":"Opus 5.5"},"context_window":{"used_percentage":42}}' | node scripts/public/statusline/claude-statusline.js
```

To check that the variants match, pipe the same payload into both and `diff` the output.
