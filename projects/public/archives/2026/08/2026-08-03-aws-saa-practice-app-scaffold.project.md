---
title: AWS SAA Practice App — Neumorphic Scaffold
description: >
  Scaffold the aws-saa-practice-app repo: replace the Vite default template with a neumorphic flashcard shell (multiple-choice card, placeholder deck types) for AWS Solutions Architect Associate practice
status: completed
priority: medium
owner: Aaron
created: 2026-08-03
tags: [aws, saa, flashcards, neumorphism, react, vite, scaffold]
related_projects: []
---

# AWS SAA Practice App — Neumorphic Scaffold

## Summary

Turn `repositories/aws-saa-practice-app` (fresh Vite + React 19 + TypeScript submodule, initial commit only) into the neumorphic shell of an SAA practice app: a soft-touch flashcard UI where the user works through multiple-choice questions. This project covers the scaffold and the card interaction model only — the real question bank, progress persistence, and exam features are follow-up projects.

Design system: Kosmos neumorphism skill (`.opencode/skills/neumorphism/`), starting from `references/kit.css` — same surface color for element and page, paired light/dark dual shadows, accent reserved for status/data.

## Requirements

- [x] Replace the Vite default template with the neumorphic app shell (design tokens + recipes from kit.css)
- [x] Flashcard stage: one multiple-choice question at a time (question, 4 options, select → auto-grade)
- [x] Right/wrong feedback with accent/negative styling and a next-card flow
- [x] Deck types (`Question`, `Option`, `Deck`) and placeholder deck structure defined; no real question bank yet
- [x] 1–2 clearly-marked placeholder questions so the interaction is verifiable end-to-end
- [x] Session score + streak, in-memory only (resets on reload)
- [x] Header with score/streak display, progress through the deck
- [x] Accessibility: `:focus-visible` outlines on every interactive element; interactive elements identifiable by shape/label, not shadows alone
- [x] Motion + responsive per skill (rise/grow/widen orchestration, `prefers-reduced-motion`, 860px/480px breakpoints)
- [x] Builds clean in the submodule: `npm run build` and `npm run lint` pass
- [x] Smoke test the MC flow in `npm run dev`

## Implementation Plan

### Phase 1: Shell and design system

- [ ] Import kit.css tokens/recipes (surface, shadows, ink/muted/accent, radii, fonts) into the app
- [ ] Page layout: header (app title, score/streak), main flashcard stage, footer
- [ ] Scaffold placeholder deck data module (`src/data/`) with `Question`, `Option`, `Deck` types
- [ ] Set page title/`index.html` for the app

### Phase 2: Multiple-choice card model

- [ ] Card stage component: question text + 4 selectable options (segmented/raised button treatment)
- [ ] Selection → auto-grade: highlight correct answer, mark wrong pick with negative accent, disable further picks
- [ ] Feedback area + "Next card" button; end-of-deck state showing final score/streak
- [ ] Session score + streak tracking (in-memory module)
- [ ] Wire placeholder deck through the stage so the flow runs end-to-end

### Phase 3: Polish and verification

- [ ] Rest/hover/active micro-interactions on buttons and options
- [ ] Entrance motion orchestration (rise stagger), respecting `prefers-reduced-motion`
- [ ] Responsive pass at 860px and 480px
- [ ] `:focus-visible` outlines on all interactive elements
- [ ] Run `npm run build` and `npm run lint` in the submodule
- [ ] Smoke test in `npm run dev`: answer cards, wrong/right feedback, end-of-deck, score/streak

## Progress

- 2026-08-03: Project created (planning).
- 2026-08-03: Implementation complete — all phases done in `repositories/aws-saa-practice-app`:
  - Neumorphic shell (kit.css tokens/recipes) in `src/index.css`; Vite default template removed
  - Types (`src/types.ts`), placeholder deck (`src/data/placeholderDeck.ts`, 2 marked-placeholder MC questions)
  - MC card stage (`src/components/FlashcardStage.tsx`): select → auto-grade, correct/wrong pressed states, feedback + explanation, next flow
  - Session score + streak (in-memory), progress track, end-of-deck panel with restart
  - Motion (rise stagger, progress widen), `prefers-reduced-motion`, 860px/480px breakpoints, `:focus-visible` outlines
  - Verification: `npm run lint` clean, `npm run build` clean (tsc -b + vite build), dev server smoke test (HTTP 200, title), SSR render check of every stage state (unanswered / correct / wrong)
  - Responsive pass verified in real headless Chrome (DevTools Protocol) at 390 / 768 / 1440 px: zero horizontal overflow, header stacks on mobile, full-width pills + progress, 53px touch targets, plus a full click-through E2E (correct → wrong → end panel → restart)
- 2026-08-03: Question deck pipeline added — author in `questions/*.md`, convert with `scripts/build-deck.mjs`:
  - Data model extended: `Option.rationale?`, `Question.reference?`, `domain` required
  - Authoring format: `###` prompt, `- [x]` marks correct, indented `Rationale:` lines, `Explanation:` / `Reference:` sections; domain derived from filename (acronym/lowercase-aware)
  - Converter (zero deps): validation (exactly one `[x]`, ≥2 options, non-empty prompt/explanation) with file:line errors and exit 1; auto ids `saa-001`…; writes checked-in `src/data/deck.ts`; `QUESTIONS_DIR`/`DECK_OUT` env overrides for testing
  - Wired as `npm run build:deck` + `predev` hook
  - App: imports generated deck (placeholder deleted); feedback shows picked-option rationale + reference link
  - Verified: negative fixtures (two `[x]`, missing explanation) exit 1 with line refs; lint/build clean; headless Chrome smoke (domain chip, rationale, reference href, end panel)
- 2026-08-03: Consolidated to single deck file + `saa-question` skill:
  - Deck lives in one long-running `questions/deck.md`; `# ` H1 headings are domain sections (domain no longer derived from filename); `### ` starts a question
  - Converter updated: H1 sets section domain, bare `#` → "empty # domain section" error, question outside a section → error; seeded 2 questions (`saa-001` IAM, `saa-002` Storage)
  - New skill `.opencode/skills/saa-question/` — captures pasted questions (prompt/options/correct/rationales/explanation/reference/domain), strips source artifacts like inline "Correct answer" tags, asks to confirm ambiguous answers, appends to the right section, then auto-runs `npm run build:deck` and fixes validation failures
  - Verified: deck.ts byte-identical after migration; negative fixtures (no section, bare `#`, two `[x]`) all exit 1 with file:line; append simulation produced stable ids (saa-001, saa-002); lint/build clean
- 2026-08-03: Per-question files + `Domain:` field:
  - `Domain:` is now a required per-question directive (free-form exam domain, e.g. Design Secure Architectures); `#` headings removed — flat blocks
  - One file per question: `questions/01.md`, `02.md`, ... (zero-padded, incrementing); id = filename (`01.md` → `saa-01`); deck order = numeric file order; deleting a file never renumbers the rest
  - Converter validates: filename pattern, one question per file, non-empty file, missing `Domain:` — all exit 1 with file:line; parser tolerant of any indentation for Rationale/continuation lines (editor reformatting can't silently corrupt the deck)
  - Skill (`saa-question`) updated: creates next-numbered file (`max + 1`), captures exam domain
  - Verified: numeric sort (01 before 10), all fixtures exit 1, lint/build clean

## Review

- All requirements met; verification proved rendering of every quiz state plus clean lint/build.
- Deck is deliberately placeholder (2 questions, `Networking` domain) — the real SAA question bank is the follow-up project.
- Note: `repositories/aws-saa-practice-app` is registered in `.gitmodules` but not tracked as a gitlink in the parent index (`git submodule add` it before committing the parent repo, or changes here won't be visible to it).

## Related

- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — AWS networking lab notes, a future content source for the SAA question bank
- Repo: `repositories/aws-saa-practice-app` (git submodule; registered in `.gitmodules`, not yet tracked as a gitlink in the parent index)
