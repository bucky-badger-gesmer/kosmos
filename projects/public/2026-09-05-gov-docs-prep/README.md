# GovDocs Interview Prep — Index

Onsite: **Wednesday, Sept 9**, 2:00–4:30pm. Full Stack Software Engineer (front-end heavy).

## The panels

| Time | Who | Focus |
|---|---|---|
| 2:00–3:00 | Patrick Mazurek (SWE), Ben Alman (Sr. SWE) | **Tech panel:** code review, tech questions, whiteboarding |
| 3:00–4:00 | Nick Running (Data Eng Mgr), Dan Tschida (PM) | **Culture panel:** experience, collaboration |
| 4:00–4:30 | Alex Bliss (SWE Mgr) | Your questions + feedback |

Last year's format (per your memory): basic tech questions → walk through a Lambda function → whiteboard a React app. Assume similar, prepare broader.

**You are a returning candidate who declined an offer.** Every interviewer knows this. Read `returning-candidate.md` first and write your three-sentence answer before you do anything else.

**Look up all five interviewers on LinkedIn** before Wednesday. Know what each has worked on and for how long. If Ben Alman is the JavaScript developer behind Grunt and several widely used jQuery plugins, expect deep JS fundamentals from him; confirm before assuming.

## Files in this folder

- **`returning-candidate.md`** — the "what changed since last year" answer, compensation prep, and how to use Alex's slot to close. **Read this first.**
- **`govdocs-tech-panel-prep.md`** — the game plan: two cold code-review snippets with answer keys, tech-question bank, three whiteboard scenarios, and a weekend schedule. **Start here.**
- **`practice-snippets.md`** — five *fresh* cold code-review snippets (async/Promise, Mongo aggregation, Mantine form, React table, Playwright test) with answer keys at the bottom. Work these with a timer before reading the keys.
- **`frontend-whiteboard.md`** — the React app whiteboard, worked end to end. Last year's whiteboard *was* a React app and the JD is front-end first, so this is the most likely scenario.
- **`whiteboard-walkthrough.md`** — one backend whiteboard scenario worked fully end to end (clarify → sketch → data model → failure modes → tradeoffs), with the exact lines to say out loud. A model for the *shape* of a strong answer.
- **`coding-warmups.md`** — nine short functions to write cold in case whiteboarding means code: debounce, hooks, groupBy, fetch with abort, tree flatten, event-loop prediction.
- **`basics-rapid-fire.md`** — the plain one-line answers for Git, React, and TypeScript *basics* (fetch vs pull, reset flavors, error boundaries, global state, `!` and `?`, erased types), plus a debugging method and front-end performance vocabulary. Last year's tech questions were basics; this is that bucket.
- **`frontend-fundamentals.md`** — CSS, browser rendering, CSRF and cookies vs tokens, testing philosophy (RTL, MSW, testing a Lambda), TypeScript extras, React 18/19, Express. The "basic tech questions" the other files skip.
- **`react-typescript-review.md`** — front-end deep dive. Weighted heaviest; the role is front-end-first.
- **`mongodb-review.md`** — data modeling, indexing, aggregation, `explain`. This is for the tech panel (Patrick and Ben). Nick runs Data Engineering but is on the *culture* panel; with him, be ready to talk about how you've worked alongside data people, not to be quizzed on indexes.
- **`lambda-aws-review.md`** — the "walk through a Lambda" round. Execution model, connection reuse, event sources.
- **`js-async-http-fundamentals.md`** — Promises, event loop, REST/HTTP. The "basic tech questions" bucket.
- **`tooling-review.md`** — Mantine, Playwright, Datadog, CI/CD, Git. All named in the JD, none in the prep doc. Low effort to review, easy signal to show.
- **`culture-panel-prep.md`** — STAR stories mapped to their "Who You Are" list, plus questions to ask each interviewer.
- **`master-summary.md`** — the whole folder in one file: every snippet's headline findings, all four whiteboard scenarios compressed, the warm-ups, every topic digest, culture stories, and questions to ask. Study from this when you don't want to open sixteen files.
- **`fundamentals-and-gotchas.md`** — bird's-eye review of React, TypeScript, MongoDB (heaviest, with a plain-English tour of every aggregation stage), Lambda, and Git/GitHub: what each is, the concepts to have straight, and 12–15 classic gotchas per topic. Minimal code.
- **`cheat-sheet.md`** — one page of the ~50 most-worth-having-fresh facts. Read this in the 30 minutes before you walk in — reactivation, not learning.

## What the JD tells us to weight

Named explicitly under "What You Bring":
- **React, TypeScript, responsive UI (Mantine), Playwright** — front-end is the core.
- **AWS Lambda, REST APIs, MongoDB** — backend breadth.
- **CI/CD, Git workflows, Datadog (observability), testing best practices.**
- Soft signals: *coachability, curiosity, growth mindset, clear communication.* This is a **mentored role** ("dedicated mentor," "learn from teammates"). They are hiring for trajectory, not just current skill — lean into how you learn.

## Domain context (say this fluently)

GovDocs = **employment law compliance**. Two lines:
1. **Posting Service** — physical labor-law posters, 1,500+ postings across US/Canada, tracked per location (PosterCheck).
2. **Compliance SaaS** — Minimum Wage + Paid Leave products; identify which laws apply to a company's locations/employees.

The hard problem is **jurisdictional variance** (Federal → State → Local) and **change over time** (a law valid last year must stay reconstructable). Every whiteboard answer lands better when framed in this domain.

## Suggested order

1. Read `returning-candidate.md` and write your answer. Then `govdocs-tech-panel-prep.md` end to end.
2. Work `frontend-whiteboard.md` before the backend whiteboard. It is the likelier one.
3. Deep-dive the four technical review files, hardest-first for you. Then `coding-warmups.md` on paper.
4. `basics-rapid-fire.md` and `frontend-fundamentals.md` once through, self-check questions only.
5. Skim `tooling-review.md` — cheap points.
6. `culture-panel-prep.md` last, Tuesday. Stop tech prep Tuesday evening.
