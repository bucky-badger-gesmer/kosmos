---
title: Plate & Plate
description: Self-coached fitness app — daily workout, meal plan with calorie ceiling, weigh-ins, and Friday check-ins that drive plan adjustments
status: planning
priority: medium
owner: Aaron
created: 2026-09-28
tags: [fitness, nextjs, supabase, personal, app]
related_projects: []
---

# Plate & Plate

## Summary

A personal app that shows today's workout and meal plan. It includes a calorie ceiling for days off the plan, daily weigh-ins, and a Friday check-in that recommends whether to hold the plan or step it up or down.

It is rebuilt from past coaching programs and meal plans. The detailed spec, which contains health data, lives in the **private** repo at `repositories/plate-and-plate/docs/spec.md`. This file stays free of health numbers because kosmos is public.

Stack: Next.js (App Router, TypeScript, PWA) on Vercel, with Supabase for Postgres, auth and row-level security.

## Implementation Plan

### Phase 0: Approval

- [ ] Review `docs/spec.md`: scope, adjustment ladder, starting point, data model
- [ ] Approve new dependencies: Next.js, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI, and a chart library for trends
- [ ] Create a Supabase project, and decide on a Vercel project

### Phase 1: Data

- [x] Parse the workout and meal-plan PDFs into seed JSON, and review it by hand
- [x] Build the `foods` table with kcal and macros per unit
- [x] Confirm the computed kcal for each meal version matches the estimates in the spec (within about 5%)

### Phase 2: Scaffold

- [x] Next.js app in `repositories/plate-and-plate`
- [x] Supabase migrations for the data model, plus row-level security on every table (written, not yet pushed)
- [x] Magic-link sign-in for a single user
- [x] Link the Supabase project, run `db push`, generate types
- [x] Magic-link sign-in tested end to end by Aaron. Row-level security confirmed: without sign-in, reads return nothing and inserts are rejected
- [x] Load the seed data

### Phase 3: Today plus logging

- [x] Today view: workout for today's weekday and the active meal version (ceiling, protein floor, cardio)
- [x] Daily log: weight (required), steps, cardio, water, sleep
- [x] Meal checkboxes, plus quick kcal/protein entry when off plan
- [ ] Set logging with last time's weights and a suggestion to add load

### Phase 4: Check-in plus trends

- [ ] Friday check-in: 7-day averages, adherence, the ladder's recommendation, and your decision, which creates a new version if the plan changes
- [ ] Trends: weight (daily plus 7-day average) with version changes marked, and calories vs ceiling

### Phase 5: Verify

- [ ] Walk through a seeded week on a phone-sized viewport: log days, run a Friday check-in, step down a rung
- [ ] Row-level security check: requests without a signed-in user get nothing back

## Progress

- 2026-09-28: Private repo created and added as a submodule. Reviewed all 19 source PDFs, then wrote the spec (history synthesis, adjustment ladder, data model).
- 2026-09-28: Phase 2 scaffold done, except for connecting to Supabase.
  - Stack: Next.js 16.3.6, React 19, Tailwind 4, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.2, and the Supabase CLI 2.118.0 as a dev dependency.
  - The initial migration creates 13 tables, each with owner-only row-level security.
  - Sign-in is magic link only, with no self-signup. `src/proxy.ts` refreshes the session (Next 16 renamed middleware to proxy).
  - PDF text extraction moved from a Swift script to Python with `pdfplumber`, which was already installed and extracts more cleanly.
- 2026-09-28: Phase 1 done.
  - PDFs parsed into seed JSON (`npm run seed:build`).
  - Second migration adds undated plan templates, whole-meal variants (the coach's "Option #2"), a calorie/macro totals view, and clone functions.
  - Seeded the coach templates plus a starting meal plan and program dated 2026-09-28.
- 2026-09-28: Phase 3 Today screen done, except set logging.
  - Plain forms call server actions, so they work before JavaScript loads. Each action checks sign-in and validates its input.
  - `?date=` lets you look at and log other days. "Today" follows `APP_TIME_ZONE` (default America/Chicago).

## Review

### Phase 3 Today screen (2026-09-28)

- Type check, lint, and `next build` pass.
- Tested with Node: meal and eaten-today totals, main vs alternate meal options, weekday mapping, date parsing. This caught `2026-02-30` being accepted as a valid date, which is now fixed.
- Aaron used the screen in his browser (meal logging, undo, day navigation), and the server logs show no errors.
- Upserts rerun as `authenticated` in a rolled-back transaction work: the row is created, then updated on conflict, with row-level security on.

### Phase 1 data (2026-09-28)

- Workout parser: 9 programs and 277 prescriptions, with a 130-exercise library. Name variants are merged, and the extra words become notes.
  - Checked by hand: one 2021 month and the latest 2024 Monday, line for line against the source text.
  - One ambiguous rest note was settled by its position on the PDF page.
- Meal parser: 10 coach versions, built from a hand-checked catalog of 50 foods. Any bullet line not in the catalog stops the parser.
  - Calculated totals come within 1.5% of the spec's estimates.
- Database: counts match the JSON.
  - 307 program rows: 277 parsed plus 30 copied into the current program.
  - The totals view agrees with the Python calculation to within 1 kcal.
  - The Supabase security advisor flags nothing on the tables, view, or functions.
- Bug found: the first seed run failed because a plpgsql variable shared a name with a table alias. The block rolled back cleanly, and the variables are now all prefixed.

### Phase 2 scaffold (2026-09-28)

Tested with placeholder Supabase credentials:

- `tsc --noEmit`, `eslint`, and `next build` all pass. The build shows the routes `/`, `/login`, `/auth/callback`, plus the proxy.
- On the dev server:
  - `/` while signed out redirects (307) to `/login`.
  - `/login` returns 200 and shows the sign-in form.
  - `/auth/callback` with no code redirects to `/login?error=auth`.
- Not yet tested: the migration SQL. There's no local Postgres or Docker, so the first real run will be `db push`.

## Related

- Repo: `repositories/plate-and-plate` (private)
