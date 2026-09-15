---
title: Personal Contacts Backend
description: Express/TypeScript API for a personal contacts prototype, persisting contacts in SQLite via better-sqlite3
status: completed
priority: medium
owner: Aaron
created: 2026-09-03
tags: [contacts, express, typescript, sqlite, better-sqlite3, prototype, api]
related_projects: []
---

# Personal Contacts Backend

## Summary

Backend for a personal contacts prototype web app. Express + Node + TypeScript (ESM), with contacts stored in a local SQLite file.

v1 is a single-resource REST API: create, list, get one, update, and delete. No auth, no multi-user, no frontend in this project.

### Stack decision: `better-sqlite3` — yes

Use **`better-sqlite3`** (current: 13.x) as the SQLite driver. That is the right library for this prototype.

| Option | Verdict |
| --- | --- |
| **better-sqlite3** | **Chosen.** Fastest Node SQLite binding. Synchronous API matches SQLite’s single-writer model. Prepared statements, transactions, WAL. TypeScript via `@types/better-sqlite3`. Prebuilds for major platforms; native compile fallback if needed. |
| `sqlite3` (node-sqlite3) | Skip. Older async/callback API, slower, worse DX. |
| `node:sqlite` (built into Node 22.5+) | Viable later. Zero native deps, similar sync API. Still experimental on Node 22 LTS (`lts/*` in this workspace). Node 26 has stabilized it. Revisit if we want zero native addons. |

Do **not** add an ORM (Drizzle/Prisma) for a one-table prototype. Raw SQL + prepared statements is enough.

Recommended SQLite setup: file-backed DB (not in-memory), `journal_mode = WAL`, schema applied on startup.

## Requirements

- [x] Express + TypeScript Node server (strict TS, ESM or CJS — pick one and stick to it)
- [x] SQLite via `better-sqlite3` + `@types/better-sqlite3`; file-backed DB that survives restarts
- [x] Contacts table persisted in SQLite (starter schema below)
- [x] `POST /contacts` — create
- [x] `GET /contacts` — list
- [x] `GET /contacts/:id` — get one
- [x] `PATCH /contacts/:id` — edit (partial update)
- [x] `DELETE /contacts/:id` — delete
- [x] JSON request/response; 404 when id is missing; basic input validation
- [x] CORS enabled so a later frontend can call this API
- [x] Verify all five operations against the real DB (curl or equivalent) — not just “the server starts”

### Starter contact schema

Editable — this is a sensible v1, not locked.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK AUTOINCREMENT | |
| `first_name` | TEXT NOT NULL | required |
| `last_name` | TEXT | optional |
| `email` | TEXT | optional; unique if present |
| `phone` | TEXT | optional |
| `notes` | TEXT | optional |
| `created_at` | TEXT NOT NULL | ISO-8601 |
| `updated_at` | TEXT NOT NULL | ISO-8601 |

Out of scope for v1: auth, pagination, search, frontend, multi-user, cloud deploy.

## Implementation Plan

### Phase 1: Scaffold and database

- [x] Create the app (new repo under `repositories/` unless another location is chosen)
- [x] TypeScript + Express + `better-sqlite3` + `@types/better-sqlite3`
- [x] Open a file-backed SQLite DB; enable WAL; run `CREATE TABLE IF NOT EXISTS contacts ...` on startup
- [x] Health check: `GET /health` → `{ ok: true }`

### Phase 2: Contact CRUD

- [x] Contact type + row mapping (snake_case columns ↔ camelCase JSON)
- [x] `POST /contacts` — insert, return 201 + created record
- [x] `GET /contacts` — return all contacts
- [x] `GET /contacts/:id` — 200 or 404
- [x] `PATCH /contacts/:id` — update provided fields, bump `updated_at`, 200 or 404
- [x] `DELETE /contacts/:id` — 204 or 404
- [x] Reject invalid bodies (missing `firstName`, empty strings, bad email shape)

### Phase 3: Verify

- [x] CORS + JSON error shape (`{ error: string }`)
- [x] Prove each endpoint against the SQLite file: create → list → get → edit → delete → get 404
- [x] Confirm the DB file on disk contains the rows after restart

## Progress

- 2026-09-03: Project created (planning). Stack validated: Express/TypeScript + SQLite via `better-sqlite3`. v1 is full CRUD (list + get included).
- 2026-09-03: Phase 1 complete in `repositories/personal-contacts-backend` (local git repo, not yet a GitHub submodule).
  - ESM TypeScript (strict, NodeNext). Node 24 runs `src/*.ts` directly — no `tsx`/build step.
  - Express 5.2.1 + `better-sqlite3` 13.0.3 + `@types/better-sqlite3`.
  - File-backed SQLite at `data/contacts.db` (`DB_PATH` override); `journal_mode = WAL`; `CREATE TABLE IF NOT EXISTS contacts` on startup.
  - `GET /health` → `{ ok: true }`. Default port 3000 (`PORT` override).
- 2026-09-03: Phases 2–3 complete. Full CRUD + validation + CORS, verified against `data/contacts.db` including a process restart.

## Review

### Phase 1 (2026-09-03)

Verified against a running server (`npm start` in `repositories/personal-contacts-backend`):

- `GET http://localhost:3000/health` → `200` `{ "ok": true }`
- `npx tsc --noEmit` clean
- `data/contacts.db` created on disk; `PRAGMA journal_mode` = `wal` (`contacts.db-wal` / `contacts.db-shm` present)
- `contacts` table columns match the starter schema (`id`, `first_name`, `last_name`, `email UNIQUE`, `phone`, `notes`, `created_at`, `updated_at`)

### Phases 2–3 (2026-09-03)

`npx tsc --noEmit` clean. Live API against `data/contacts.db`:

- `POST /contacts` → `201` camelCase JSON (`firstName`, `createdAt`, …)
- `GET /contacts` includes the created row; `GET /contacts/:id` → `200`
- `PATCH /contacts/:id` updates provided fields and bumps `updatedAt`
- SQLite row used snake_case (`first_name`, `last_name`, `updated_at`) matching the JSON
- Stopped the process; row still on disk; `GET /contacts/1` after restart returned the patched contact
- `DELETE /contacts/:id` → `204`; subsequent GET → `404` `{ "error": "Contact not found" }`; table empty
- Validation: missing/empty `firstName`, empty optional strings, bad email → `400`; duplicate email → `409`; invalid JSON → `400`
- CORS: `Access-Control-Allow-Origin: *` on responses; `OPTIONS /contacts` → `204` with PATCH allowed

No GitHub remote / kosmos submodule yet.

## Related

- Memory: —
- Todo: —
- Idea: —
