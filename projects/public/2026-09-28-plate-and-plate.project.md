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

- [ ] Parse the workout and meal-plan PDFs into seed JSON, and review it by hand
- [ ] Build the `foods` table with kcal and macros per unit
- [ ] Confirm the computed kcal for each meal version matches the estimates in the spec (within about 5%)

### Phase 2: Scaffold

- [x] Next.js app in `repositories/plate-and-plate`
- [x] Supabase migrations for the data model, plus row-level security on every table (written, not yet pushed)
- [x] Magic-link sign-in for a single user
- [x] Link the Supabase project, run `db push`, generate types
- [x] Magic-link sign-in tested end to end by Aaron. Row-level security confirmed: without sign-in, reads return nothing and inserts are rejected
- [ ] Load the seed data

### Phase 3: Today plus logging

- [ ] Today view: workout for today's weekday and the active meal version (ceiling, protein floor, cardio)
- [ ] Daily log: weight (required), steps, cardio, water, sleep
- [ ] Meal checkboxes, plus quick kcal/protein entry when off plan
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

## Review

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
