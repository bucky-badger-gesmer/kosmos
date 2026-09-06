# Cheat Sheet — Read in the 30 Minutes Before

One page. The facts most worth having fresh. Not for learning — for reactivating. If a line doesn't ring a bell, open its full file.

---

## The 3 methods (run these every time)

- **Code review:** correctness → security → error handling → performance → readability → **testability** ("the test I'd want here is ___"). Label **blocking** vs **nit**. Open with a question about *intent*, not a criticism. Say what's *right* too.
- **Backend whiteboard:** Clarify → Sketch → Data model → Trace one request → Failure modes → Tradeoffs rejected → If we had more time. **State assumptions and move.**
- **Front-end whiteboard:** Clarify → Screens → Component tree → **State placement (server / URL / local / context)** → Data contract → Loading, empty, error → Performance → A11y + responsive → Testing (unit / RTL / Playwright) → Tradeoffs.
- **Tech Q answer:** direct answer → why it works that way → a time you hit it in production.

---

## React

- Re-render triggers: state, props, parent render, context. **New object/array identity = a change** (Object.is).
- `setState` with the **same reference** → React bails, no render. Always make a new reference.
- `useEffect` **captures values from its render** → omitted dep = stale closure. Cleanup cancels in-flight work (AbortController) to stop out-of-order resolution.
- Strict Mode double-invokes effects **in dev only**.
- Index `key` breaks on **reorder/filter/insert**, not append. Use a stable id.
- `useMemo` helps when the child is expensive OR the value feeds a deps array. Otherwise noise.
- `<div onClick>` = a11y bug → use `<button>`.
- **Error boundary** catches render errors below it, not handlers or async. One per route. **Global state:** server data → React Query; small UI state → Context; heavy → Zustand/Redux.

## TypeScript

- **`unknown`** forces narrowing; **`any`** disables checking. API data → `unknown`/Zod at the boundary.
- **Discriminated union + `const _: never = x`** exhaustiveness = highest-signal answer. Have the example.
- `as` asserts, doesn't prove — prefer type guards. `as const` + `typeof X[number]` derives a union from a list. Prefer unions over enums.
- React 19: `ref` is a prop (no `forwardRef`), `use()`, `useOptimistic`, form Actions. Ask which version they run.

## MongoDB

- **Prefix rule:** index `{a:1,b:-1}` serves `a` and `a+b`, NOT `b` alone.
- **ESR** field order: Equality → Sort → Range.
- Slow query? `explain('executionStats')` → **IXSCAN vs COLLSCAN**, docsExamined ≈ nReturned.
- **N+1 fix:** `$in` (batch) or `$lookup` (join). Rewrite the loop live.
- Aggregation: **`$match` first / early** — only a leading `$match` uses indexes.
- Embed if bounded + always-read-together; reference if unbounded/shared. **16 MB doc limit.**
- `_id` **ObjectId vs string** mismatch → returns null forever (looks like "no data").
- Tenant id = first index field + non-optional filter on every query. From auth context, not user input.
- Compliance model: **append-only versions with effective-date ranges**, never in-place edits.

## Lambda / AWS

- **Module scope runs once per env, reused warm. Handler runs every invoke.** DB client at module scope; **never `close()`**.
- Cold start = new env init (package + runtime + module code). Reduce: smaller bundle, provisioned concurrency (costs money idle).
- Scales horizontally → each env has its own pool → **downstream connection exhaustion**. Fix: small `maxPoolSize`, reserved concurrency, RDS Proxy.
- Memory ↔ CPU coupled. **Lambda 15 min max; API Gateway 29 sec.** Longer → async + status endpoint.
- Async sources (S3/SNS) retry; SQS retries → DLQ. **Handlers must be idempotent** (dedupe key + unique index). SQS batch: catch per record, return `batchItemFailures`. `callbackWaitsForEmptyEventLoop = false` in old callback handlers is **not a bug**.
- Payloads: Lambda 6 MB, API GW 10 MB → big uploads go **direct to S3 via pre-signed URL**.

## CSS / browser / security

- Flex = 1-D, content-driven. Grid = 2-D, layout-driven. `box-sizing: border-box` everywhere. `rem` for type/spacing.
- Modal behind header = **stacking context**, not z-index number.
- **CSRF:** cookie auto-sent → fix with `SameSite` + token. Bearer header immune to CSRF, exposed to XSS. httpOnly cookie = the reverse.
- CORS protects the *user*, not your server. Auth every request anyway.
- Debounce = wait for quiet (search). Throttle = max once per interval (scroll).
- Event loop: `1 6 8 3 5 7 4 2` (warm-up #8). Sync → microtasks in queue order → macrotask.

## Testing

- RTL: query by **role/label**, test behavior not internals. MSW to mock the network.
- Reviewing a Playwright test: shared state between tests, `waitForTimeout`, CSS selectors, **missing `await` on `expect`**, unquoted `text=` substring match.
- Pyramid: many unit (pure fns) → some component → few Playwright journeys. Never fix flaky with `sleep`.
- Lambda: inject `db`, assert 401/404/200. Always end a review with **"the test I'd want here is ___."**
- Say **Big-O** after any code you write.

## JS async / HTTP

- Event loop: **all microtasks (Promise callbacks) drain before the next macrotask (`setTimeout`)**.
- `Promise.all` = all-or-reject-fast. **`allSettled` = tolerate partial failure** (fan-out). `race` = first settle. `any` = first success.
- **`forEach(async …)` does NOT await.** Use `for...of` (sequential) or `map`+`Promise.all` (parallel).
- Idempotent verbs: GET, PUT, DELETE. **POST is not.** Matters for retries.
- **401** = who you are; **403** = what you're allowed. Missing resource → **404**, not 500.
- Auth in the **`Authorization` header**, never a query string. Token in localStorage = XSS-readable.

## Tooling (JD-named — speak fluently)

- **Mantine:** component lib + `@mantine/hooks` + `useForm` (`getInputProps`, `validate`, `onSubmit`). Responsive + a11y built in. v7/v8 = CSS modules + `classNames`/`styles`; **no `sx`**.
- **Playwright:** E2E, **auto-waiting** (no flaky sleeps), role-based locators (`getByRole`), trace viewer. Testing pyramid: many unit → some integration → few E2E.
- **Datadog:** metrics + logs + traces; value = correlating them. Four golden signals: latency, traffic, errors, saturation.
- **CI/CD:** push → lint+typecheck+test → build → E2E → deploy. Blue/green, canary, feature flags.
- **Git:** feature branch + PR; never rebase a shared branch; squash-merge for clean `main`. `fetch` downloads, `pull` = fetch + merge. `reset --soft/--mixed/--hard` = keep staged / keep unstaged / discard. Pushed? `revert`, never `reset`. `reflog` gets a lost commit back. Conflict: fix markers → `add` → `commit` or `rebase --continue`.
- **"Have you used X?"** → answer honestly, bridge to the equivalent you know, show you get *why* it exists. Coachability is what they're buying.

---

## Domain one-liner

GovDocs = employment-law compliance. Hard problem = **jurisdictional variance (Fed→State→Local) × change over time**. Frame every whiteboard answer in it.

## The full-stack request path (say in 90 sec)

Browser → CDN → API Gateway → Lambda (cold/warm) → auth → Mongo (indexed?) → response → React render.

---

## Mindset (last thing before you walk in)

- 20 min per section — they **expect unfinished, well-reasoned** answers, not completion.
- **Narrate the thing you're weighing** out loud — worth more than arriving silently at the answer.
- Naming a bug that **isn't there** costs more than missing one. Say what's *right* too.
- Have 2–3 real questions for **every** interviewer.
- **Returning candidate:** three sentences. What happened then (no blame) → what changed since (AWS, TS backend, agents, day-job wins) → why GovDocs now. Under 60 seconds. Your number: ______. Your floor: ______.
- **Alex's slot:** say you'd accept at the right number, ask the timeline, ask "anything about my background you'd want me to expand on?"
- Breathe. Pause before answering. You've done this interview before, and you came back on purpose.
