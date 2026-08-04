---
title: AWS SAA Practice App — Shuffle Mode Toggle
description: >
  Add a shuffle toggle to the AWS SAA practice app so users can choose to work questions in deck order or in randomized order, switchable from a segmented control in the header
status: completed
priority: medium
owner: Aaron
created: 2026-08-04
tags: [aws, saa, flashcards, react, typescript, vite]
related_projects: [2026-08-03-aws-saa-practice-app-scaffold.project.md]
---

# AWS SAA Practice App — Shuffle Mode Toggle

## Summary

Add a question-order shuffle mode to `repositories/aws-saa-practice-app`. Currently the app walks the generated `deck` array in fixed order (`deck[current]` in `src/App.tsx`). This project adds a working-deck state so the session can present questions in either authored order or shuffled (Fisher-Yates) order, selected via a segmented `In order | Shuffle` toggle in the header. Shuffles question order only — answer options within each question keep their authored letters. Toggling mid-session restarts the session (reordering invalidates in-flight progress).

## Requirements

- [x] Header toggle: segmented `In order | Shuffle` control, styled with existing neumorphic pill/button conventions (`src/index.css` `.status-pill` / `.btn`)
- [x] Shuffle mode presents all questions in random order (Fisher-Yates, no repeats)
- [x] Toggling resets session state (current, selected, answered, score, streak, bestStreak, finished) and swaps the working deck
- [x] `Run it back` restart honors the current mode — reshuffles again in shuffle mode so repeat runs feel fresh
- [x] No changes to generated `src/data/deck.ts`, the question authoring pipeline, or `Question`/`Option` types
- [x] Accessibility: toggle is keyboard-accessible with `:focus-visible` outline; active mode conveyed by shape/pressed state, not color alone
- [x] `npm run lint` and `npm run build` pass in the submodule

## Implementation Plan

### Phase 1: Deck state + shuffle logic (`src/App.tsx`)

- [ ] Replace direct `deck` reads with `questions` state (`useState(deck)`); update all `deck[current]` / `deck.length` references
- [ ] Add `mode` state: `'ordered' | 'shuffled'`
- [ ] Add Fisher-Yates `shuffle` helper (local function in `App.tsx`, no new file)
- [ ] Toggle handler: `shuffled` → `setQuestions(shuffle([...deck]))`; `ordered` → `setQuestions(deck)`; reset session state
- [ ] Update `handleRestart` to reshuffle in shuffle mode

### Phase 2: Header toggle UI

- [ ] Render segmented control in header pill row (or adjacent row), `aria-pressed` / `role="group"` semantics
- [ ] `src/index.css`: styles for the toggle — raised inactive segment, pressed active segment, focus-visible outline, consistent with existing neumorphic tokens

### Phase 3: Verification

- [ ] `npm run lint` clean
- [ ] `npm run build` clean (tsc -b + vite build)
- [ ] `npm run dev` smoke test: toggle to shuffle → questions appear in different order, no duplicates/missing; restart reshuffles; toggle back → authored order
- [ ] Keyboard check: tab to toggle, activate with Enter/Space

## Progress

- 2026-08-04: Project created (planning).
- 2026-08-04: Implementation complete in `repositories/aws-saa-practice-app`:
  - `src/App.tsx`: `questions` state (working deck) replaces direct `deck` reads; `mode` state (`'ordered' | 'shuffled'`); Fisher-Yates `shuffle` helper; `handleModeChange` swaps deck + resets session; `handleRestart` reshuffles in shuffle mode; segmented `In order | Shuffle` toggle in header pill row (`role="group"`, `aria-pressed`)
  - `src/index.css`: `.mode-toggle` / `.mode-btn` styles — raised track, pressed (inset-shadow) active segment, hover ink, `:focus-visible` accent outline; mobile-friendly via existing pill-row stacking
  - Generated deck, types, and question pipeline untouched
  - Verification: `npm run lint` clean, `npm run build` clean (tsc -b + vite build); headless Chrome E2E: shuffled traversal visits all 65 questions with zero duplicates; toggle back restores authored order; toggling mid-session resets score/progress; re-entering shuffle and "Run it back" both produce a fresh order; keyboard focus verified

## Review

- All requirements met; verified in headless Chrome, not just typechecked.
- Shuffle is question-order only; option letters stay fixed per authored file (per scope decision).
- Re-clicking the active mode is a deliberate no-op (no reshuffle) — fresh order comes from toggling out/in or "Run it back".

## Related

- Repo: `repositories/aws-saa-practice-app` (git submodule)
- Project: [[2026-08-03-aws-saa-practice-app-scaffold.project.md]] — original scaffold, design system, and question pipeline
