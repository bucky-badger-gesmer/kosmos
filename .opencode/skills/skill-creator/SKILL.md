---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance in OpenCode. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or improve a skill's description for better triggering accuracy.
---

# Skill Creator (OpenCode)

A skill for creating new skills in OpenCode and iteratively improving them.

At a high level, the process goes like this:

- Decide what you want the skill to do and roughly how it should work
- Write a draft of the skill
- Create a few test prompts and run the model-with-the-skill on them
- Help the user evaluate the results both qualitatively and quantitatively
  - While the runs happen in the background, draft some quantitative evals if there aren't any. Then explain them to the user.
  - Use the `eval-viewer/generate_review.py` script to show the user the results
- Rewrite the skill based on feedback from the user's evaluation of the results
- Repeat until you're satisfied
- Expand the test set and try again at larger scale

Your job is to figure out where the user is in this process and jump in to help them progress. Maybe they're like "I want to make a skill for X" — help narrow down what they mean, write a draft, write the test cases, figure out how they want to evaluate, run the prompts, and repeat. Maybe they already have a draft — go straight to the eval/iterate part.

If the user says "I don't need to run a bunch of evaluations, just vibe with me", do that instead.

Cool? Cool.

## Communicating with the user

The skill creator is liable to be used by people across a wide range of familiarity with coding jargon. Pay attention to context cues to understand how to phrase your communication. In the default case:

- "evaluation" and "benchmark" are borderline, but OK
- for "JSON" and "assertion" you want to see serious cues from the user that they know what those things mean before using them without explaining them

It's OK to briefly explain terms if you're in doubt.

---

## About skills in OpenCode

Skills live in a directory with a `SKILL.md` file at its root:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

**Discovery paths** (in priority order):
1. `.opencode/skills/<name>/SKILL.md` — project-local
2. `~/.config/opencode/skills/<name>/SKILL.md` — global

New skills should go in `.opencode/skills/` unless the user has a reason to prefer global installation.

**How skills are loaded**: At session start, OpenCode injects all discovered skill names and descriptions into context so the model knows what's available. When a task calls for it, the model calls `skill({ name: "skill-name" })` natively to load the full content. The description field is the primary trigger mechanism — it needs to be clear and specific enough that the model knows when to reach for the skill.

**Project config**: `AGENTS.md` at the project root is OpenCode's project instructions file (similar to a `CLAUDE.md` or `GEMINI.md` you might have seen elsewhere). Agent definitions live in `.opencode/agents/` and custom slash commands in `.opencode/commands/`.

---

## Creating a skill

### Capture Intent

Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to capture (e.g., they say "turn this into a skill"). If so, extract answers from the conversation history first — the tools used, the sequence of steps, corrections the user made, input/output formats observed. The user may need to fill the gaps, and should confirm before proceeding to the next step.

1. What should this skill enable the model to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases to verify the skill works? Skills with objectively verifiable outputs (file transforms, data extraction, code generation, fixed workflow steps) benefit from test cases. Skills with subjective outputs (writing style, art direction) often don't. Suggest the appropriate default based on the skill type, but let the user decide.

### Interview and Research

Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies. Wait to write test prompts until you've got this part ironed out. Check available MCP servers — if useful for research, do it in parallel via subagents where possible.

### Write the SKILL.md

Based on the interview, fill in these components:

- **name**: Skill identifier
- **description**: When to trigger and what it does. This is the primary trigger mechanism — include both what the skill does AND specific contexts for when to use it. All "when to use" info goes here, not in the body. The model tends to undertrigger skills, so make descriptions a little pushy: instead of "How to deploy to AWS", write "How to deploy to AWS. Use this skill whenever the user mentions AWS deployments, infrastructure changes, ECS tasks, or Lambda functions — even if they don't say 'deploy' explicitly."
- **the rest of the skill**

#### Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) — always in context (~100 words)
2. **SKILL.md body** — loaded when skill triggers (aim for under 500 lines)
3. **Bundled resources** — loaded as needed (unlimited size)

Keep SKILL.md under 500 lines. If approaching that limit, add a layer of hierarchy with clear pointers to reference files. For large reference files (>300 lines), include a table of contents.

**Domain organization**: When a skill supports multiple domains, organize by variant:
```
cloud-deploy/
├── SKILL.md (workflow + selection logic)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```
The model reads only the relevant reference file for the task at hand.

#### Writing Patterns

Prefer imperative form in instructions.

**Defining output formats:**
```markdown
## Report structure
Use this exact template:
# [Title]
## Executive summary
## Key findings
## Recommendations
```

**Examples pattern:**
```markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

#### Writing Style

Explain *why* things are important rather than relying on heavy-handed imperatives. Use theory of mind — today's models are smart and respond well to reasoning, not just rules. Write a draft, then read it with fresh eyes and improve. If you find yourself writing ALWAYS or NEVER in all caps, ask yourself whether you can explain the reasoning instead — that tends to work better.

### Test Cases

After writing the skill draft, come up with 2–3 realistic test prompts — the kind of thing a real user would actually say. Share them with the user: "Here are a few test cases I'd like to try. Do these look right, or do you want to add more?" Then run them.

Save test cases to `evals/evals.json`. Don't write assertions yet — just the prompts. You'll draft assertions in the next step while the runs are in progress.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
```

See the `references/schemas.md` file in the skill-creator directory for the full schema (including the `assertions` field, which you'll add later).

---

## Running and evaluating test cases

This section is one continuous sequence — don't stop partway through.

Put results in `<skill-name>-workspace/` as a sibling to the skill directory. Within the workspace, organize by iteration (`iteration-1/`, `iteration-2/`, etc.) and within that, each test case gets a directory (`eval-0/`, `eval-1/`, etc.). Don't create all of this upfront — create directories as you go.

### Step 1: Spawn all runs (with-skill AND baseline) in the same turn

For each test case, spawn two subagents in the same turn — one with the skill, one without. Don't do with-skill runs first and come back for baselines later. Launch everything at once so it all finishes around the same time.

**With-skill run:**
```
Execute this task:
- Skill path: <path-to-skill>
- Task: <eval prompt>
- Input files: <eval files if any, or "none">
- Save outputs to: <workspace>/iteration-<N>/eval-<ID>/with_skill/outputs/
- Outputs to save: <what the user cares about — e.g., "the .docx file", "the final CSV">
```

The subagent needs access to the skill. In OpenCode, skills are auto-discovered from `.opencode/skills/` at session start. For the subagent to have the skill available, the skill must be in the discovery path before the subagent session starts. Because the skill gets loaded automatically by directory discovery (not by explicit path injection), you may need to ensure it's in place before spawning subagents.

**Baseline run** (same prompt, but the baseline depends on context):
- **Creating a new skill**: no skill at all. Same prompt, save to `without_skill/outputs/`. To ensure the skill isn't active during the baseline, temporarily rename the skill directory before spawning the baseline subagent:
  ```bash
  mv .opencode/skills/my-skill .opencode/skills/my-skill.bak
  # spawn baseline subagent
  mv .opencode/skills/my-skill.bak .opencode/skills/my-skill
  ```
  Run this rename sequentially; don't overlap with with-skill runs.
- **Improving an existing skill**: the old version. Snapshot the skill before editing (`cp -r .opencode/skills/my-skill <workspace>/skill-snapshot/`), then point the baseline subagent at a session without the new skill in place.

Write an `eval_metadata.json` for each test case (assertions can be empty for now). Give each eval a descriptive name based on what it's testing — not just "eval-0". Use this name for the directory too.

```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "The user's task prompt",
  "assertions": []
}
```

### Step 2: While runs are in progress, draft assertions

Don't just wait for the runs to finish. Draft quantitative assertions for each test case and explain them to the user. If assertions already exist in `evals/evals.json`, review them and explain what they check.

Good assertions are objectively verifiable and have descriptive names — they should read clearly in the benchmark viewer. Subjective skills (writing style, design quality) are better evaluated qualitatively.

Update `eval_metadata.json` files and `evals/evals.json` with the assertions once drafted. Explain to the user what they'll see in the viewer — both the qualitative outputs and the quantitative benchmark.

### Step 3: As runs complete, capture timing data

When each subagent task completes, you receive a notification containing `total_tokens` and `duration_ms`. Save this data immediately to `timing.json` in the run directory:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

This is the only opportunity to capture this data — it comes through the task notification and isn't persisted elsewhere. Process each notification as it arrives rather than trying to batch them.

### Step 4: Grade, aggregate, and launch the viewer

Once all runs are done:

1. **Grade each run** — spawn a grader subagent (or grade inline) that reads the `agents/grader.md` file in the skill-creator directory, then evaluates each assertion against the outputs. Save results to `grading.json` in each run directory. The grading.json expectations array must use the fields `text`, `passed`, and `evidence` — the viewer depends on these exact field names. For assertions that can be checked programmatically, write and run a script rather than eyeballing it.

2. **Aggregate into benchmark** — run the aggregation script from the skill-creator directory:
   ```bash
   python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>
   ```
   This produces `benchmark.json` and `benchmark.md` with pass_rate, time, and tokens for each configuration, with mean ± stddev and the delta. Put each with_skill version before its baseline counterpart.

3. **Do an analyst pass** — read the benchmark data and surface patterns the aggregate stats might hide. See `agents/analyzer.md` (the "Analyzing Benchmark Results" section) for what to look for — things like assertions that always pass regardless of skill (non-discriminating), high-variance evals (possibly flaky), and time/token tradeoffs.

4. **Launch the viewer**:
   ```bash
   nohup python <skill-creator-path>/eval-viewer/generate_review.py \
     <workspace>/iteration-N \
     --skill-name "my-skill" \
     --benchmark <workspace>/iteration-N/benchmark.json \
     > /dev/null 2>&1 &
   VIEWER_PID=$!
   ```
   For iteration 2+, also pass `--previous-workspace <workspace>/iteration-<N-1>`.

   Use `generate_review.py` — don't write custom HTML.

5. **Tell the user**: "I've opened the results in your browser. There are two tabs — 'Outputs' lets you click through each test case and leave feedback, 'Benchmark' shows the quantitative comparison. When you're done, come back here and let me know."

### What the user sees in the viewer

The "Outputs" tab shows one test case at a time:
- **Prompt**: the task that was given
- **Output**: the files the skill produced, rendered inline where possible
- **Previous Output** (iteration 2+): collapsed section showing last iteration's output
- **Formal Grades** (if grading was run): collapsed section showing assertion pass/fail
- **Feedback**: a textbox that auto-saves as they type
- **Previous Feedback** (iteration 2+): their comments from last time

The "Benchmark" tab shows the stats summary: pass rates, timing, and token usage for each configuration, with per-eval breakdowns and analyst observations.

Navigation is via prev/next buttons or arrow keys. When done, they click "Submit All Reviews" which saves all feedback to `feedback.json`.

### Step 5: Read the feedback

When the user tells you they're done, read `feedback.json`:

```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "the chart is missing axis labels", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."},
    {"run_id": "eval-2-with_skill", "feedback": "perfect, love this", "timestamp": "..."}
  ],
  "status": "complete"
}
```

Empty feedback means the user thought it was fine. Focus improvements on the test cases where the user had specific complaints.

Kill the viewer server when done:
```bash
kill $VIEWER_PID 2>/dev/null
```

---

## Improving the skill

This is the heart of the loop.

### How to think about improvements

1. **Generalize from the feedback.** You're iterating on a few examples to move fast, but the skill will run across many different prompts in production. Rather than making narrow, over-fitted changes to satisfy the specific examples, try to understand what the examples reveal about a broader pattern. If there's a stubborn issue, branching out and trying different metaphors or patterns of working is cheap and can unlock something.

2. **Keep the skill lean.** Remove things that aren't pulling their weight. Read the transcripts (not just final outputs) — if the skill is making the model waste time on unproductive steps, trim those instructions and see what happens.

3. **Explain the why.** Try hard to explain the *why* behind everything you're asking the model to do. Models have good theory of mind and respond to reasoning, not just rules. Transmit your understanding of what the user needs into the instructions. If you find rigid all-caps directives creeping in, ask whether you can reframe the reasoning instead.

4. **Look for repeated work across test cases.** If all 3 test cases resulted in the subagent writing a `build_chart.py` or a `parse_csv.py`, that's a strong signal the skill should bundle that script. Write it once, put it in `scripts/`, and point the skill at it. This saves every future invocation from reinventing the wheel.

### The iteration loop

After improving the skill:

1. Apply your improvements to the skill
2. Rerun all test cases into a new `iteration-<N+1>/` directory, including baseline runs
3. Launch the reviewer with `--previous-workspace` pointing at the previous iteration
4. Wait for the user to review and tell you they're done
5. Read the new feedback, improve again, repeat

Keep going until:
- The user says they're happy
- The feedback is all empty (everything looks good)
- You're not making meaningful progress

---

## Advanced: Blind comparison

For situations where you want a more rigorous comparison between two skill versions, there's a blind comparison system. Read `agents/comparator.md` and `agents/analyzer.md` from the skill-creator directory for the details. The basic idea: give two outputs to an independent subagent without telling it which is which, and let it judge quality. Then analyze why the winner won. This is optional and most users won't need it.

---

## Description Optimization

The `description` field in SKILL.md frontmatter is the primary mechanism for skill triggering. After the skill is in good shape, offer to optimize it for better accuracy.

### Step 1: Generate trigger eval queries

Create 20 eval queries — a mix of should-trigger and should-not-trigger:

```json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
```

Queries must be realistic and concrete — the kind of thing a real OpenCode user would actually type. Include file paths, personal context, column names, company names, backstory. Use a mix of lengths. Focus on edge cases rather than clear-cut examples.

Bad: `"Format this data"`, `"Extract text from PDF"`

Good: `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage. The revenue is in column C and costs are in column D i think"`

For **should-trigger queries** (8–10): different phrasings of the same intent — some formal, some casual. Include cases where the user doesn't explicitly name the skill but clearly needs it. Include uncommon use cases and cases where this skill competes with another skill.

For **should-not-trigger queries** (8–10): near-misses that share keywords but need something different. Think adjacent domains and ambiguous phrasing where a naive keyword match would trigger but shouldn't. Don't make them obviously irrelevant — that doesn't test anything.

### Step 2: Review with user

Present the eval set to the user using the HTML template:

1. Read the template from `assets/eval_review.html` in the skill-creator directory
2. Replace the placeholders:
   - `__EVAL_DATA_PLACEHOLDER__` → the JSON array of eval items
   - `__SKILL_NAME_PLACEHOLDER__` → the skill's name
   - `__SKILL_DESCRIPTION_PLACEHOLDER__` → the current description
3. Write to a temp file and open it: `open /tmp/eval_review_<skill-name>.html`
4. The user can edit queries, toggle should-trigger, add/remove entries, then click "Export Eval Set"
5. The file downloads to `~/Downloads/eval_set.json`

### Step 3: Run the optimization loop

The optimization script (`scripts/run_loop.py` in the skill-creator directory) needs a CLI tool to test triggering — it was originally written to use `claude -p`. For OpenCode, use `opencode run` instead:

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --cli-command "opencode run" \
  --model <model-id-being-used> \
  --max-iterations 5 \
  --verbose
```

Use the model ID the user is currently running in OpenCode. If `--cli-command` isn't a supported flag in the version of `run_loop.py` you have, ask the user if they'd prefer to skip this step and manually test a handful of trigger queries instead — spawn a session with the skill loaded and check whether it fires for prompts you'd expect it to, then adjust the description from there.

While the loop runs, periodically tail the output and give the user updates on which iteration it's on and what the scores look like.

### Step 4: Apply the result

Take `best_description` from the output and update the skill's SKILL.md frontmatter. Show the user before/after and report the scores.

---

## Package and Present

If you have access to a `present_files` tool, package the skill and present the `.skill` file:

```bash
python -m scripts.package_skill <path/to/skill-folder>
```

Direct the user to the resulting `.skill` file path so they can install it in their OpenCode setup.

---

## Updating an existing skill

If the user is asking you to update an existing skill rather than create a new one:

- **Preserve the original name.** Note the skill's directory name and `name` frontmatter field — use them unchanged.
- **Copy to a writable location before editing.** The installed skill path may be read-only. Copy to `/tmp/skill-name/`, edit there, and package from the copy.
- **If packaging manually, stage in `/tmp/` first**, then copy to the output directory.

---

## Reference files

The skill-creator directory contains specialized subagent instructions and schemas:

- `agents/grader.md` — How to evaluate assertions against outputs
- `agents/comparator.md` — How to do blind A/B comparison between two outputs
- `agents/analyzer.md` — How to analyze why one version beat another
- `references/schemas.md` — JSON structures for evals.json, grading.json, benchmark.json

---

Core loop, one more time:

- Figure out what the skill is about
- Draft or edit the skill
- Run the model-with-the-skill on test prompts (with subagents where possible)
- With the user, evaluate the outputs — generate the eval viewer BEFORE making revisions yourself
- Repeat until you and the user are satisfied
- Package and present the final skill

Good luck!
