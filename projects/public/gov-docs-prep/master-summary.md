# GovDocs Onsite — Master Summary (everything in this folder, one file)

**Wednesday, Sept 9, 2:00–4:30pm, in office.** Full Stack Software Engineer, front-end first, $100–120k, reports to Alex Bliss.

This is the whole folder compressed into one document you can study from without opening the others. It is longer than `cheat-sheet.md` (which is the 30-minutes-before reactivation list) and shorter than the sixteen source files. When a line here is not enough, the source file is named in brackets.

| Time | Who | What |
|---|---|---|
| 2:00–3:00 | Patrick Mazurek (SWE), Ben Alman (Sr. SWE) | Tech: code review, tech questions, whiteboarding, ~20 min each |
| 3:00–4:00 | Nick Running (Data Eng Mgr), Dan Tschida (PM) | Culture: experience, working with others in and outside the team |
| 4:00–4:30 | Alex Bliss (SWE Mgr) | Your questions, your impressions, their close |

Last year: basic tech questions → walk through a Lambda → whiteboard a React app. Assume similar.

---

## 0. Review order: when to open each file and how to use it

The sections below follow this order. Work top to bottom; if you run out of time, what is skipped matters least.

| When | File | How to use it | Time |
|---|---|---|---|
| **Sun** | `returning-candidate.md` | Fill the blanks. Say the three sentences aloud five times. | 30 min |
| Sun | `govdocs-tech-panel-prep.md` §1–2 | Snippets A and B cold, timer, out loud. Then the keys; note only misses. Skim the question bank. | 60 min |
| Sun | `frontend-whiteboard.md` | Cover it. Whiteboard the Locations dashboard on paper, twice. | 45 min |
| **Mon** | `practice-snippets.md` | Snippets C–G cold, 10 min each, keys after. | 60 min |
| Mon | `coding-warmups.md` | All nine on paper, no peeking. Say Big-O after each. | 45 min |
| Mon | `whiteboard-walkthrough.md` + tech-panel §3 | Read the worked notification system once. Then Scenario 2 or 3 on paper. | 45 min |
| Mon | `react-typescript-review.md`, `mongodb-review.md`, `lambda-aws-review.md`, `js-async-http-fundamentals.md` | Read hardest-first for you. Self-check questions at the end of each; rewrite any answer over 45 seconds. | 90 min |
| Mon eve | dress rehearsal | 60 min, timer, no notes, recorded: 20 min unseen snippet, 20 min ten random questions, 20 min whiteboard. | 60 min |
| **Tue** | `basics-rapid-fire.md`, `frontend-fundamentals.md`, `tooling-review.md` | Self-check questions only. Open the section for anything that does not ring. | 45 min |
| Tue | `culture-panel-prep.md` | Fill the STAR worksheet. Say each story once, two minutes. Pick your questions per interviewer. | 60 min |
| Tue eve | stop tech | Light skim of this file's §6. Sleep. | |
| **Wed am** | `cheat-sheet.md` | Read once, 30 minutes before. Nothing else. | 20 min |

`master-summary.md` (this file) is the reference for Monday and Tuesday when you want one place to look. `README.md` is the index.


---

## 1. Sunday — returning candidate [`returning-candidate.md`]

You interviewed last year and declined the offer. All five know. Expect "what changed?" from Alex, maybe softer from Dan or Nick.

**Three sentences, under 60 seconds:**
1. What happened then, factual, no blame: *"Last year I got to the offer stage and turned it down because ______. That was the right call at the time."*
2. What changed since, specific: AWS depth (SAA study, VPC/RDS/Lambda/CloudFormation labs), an Express + TypeScript + SQLite API, agent work with MCP servers and evals, and ______ from Augeo.
3. Why GovDocs now: pick two of: shaping the early compliance SaaS, the jurisdiction-variance problem, the team and mentoring, stable growing Twin Cities company.

**"What would make you say yes?"** Answer directly: you are here to get an offer and accept it; name one or two things to confirm; say you'd like to talk through the range.

**Compensation.** Your number: ______. Your floor: ______. Consistent with anything you said last year. Give a number at the top of the posted band and stop talking; negotiate when the offer arrives.

**If someone remembers you:** "Good to see you again, glad the timing worked out." Move on. Do not apologize.

**Alex's slot, three moves:** state intent out loud, ask next steps and timeline, ask "is there anything about my background you'd want me to expand on?" Have one specific, genuine piece of process feedback ready; he asks by design.

---

## 2. Sunday — the methods [`govdocs-tech-panel-prep.md` §1–3, `cheat-sheet.md`]

- **Code review:** correctness → security → error handling → performance → readability → **testability**. Label each *blocking* or *nit*. Open with a question about intent. End with "the test I'd want here is ___." Say what is *right* too; a false finding costs more than a missed one.
- **Backend whiteboard:** Clarify → Sketch → Data model → Trace one request → Failure modes → Tradeoffs rejected → If we had more time. State assumptions and move.
- **Front-end whiteboard:** Clarify → Screens → Component tree → **State placement** (server / URL / local / context) → Data contract → Loading, empty, error → Performance → A11y and responsive → Testing (unit / RTL / Playwright) → Tradeoffs.
- **Tech question:** direct answer → why it works that way → a time you hit it in production. The third clause is the senior signal.
- **Live code:** restate → one example → edge cases → write → walk one example by hand → name Big-O. If stuck, narrate what you are deciding between.

---

## 3. Sunday (A, B) and Monday (C–G) — code review snippets [`govdocs-tech-panel-prep.md` §1, `practice-snippets.md`]

Patterns across all seven: missing `res.ok` / error handling every time; filter and shrink early; async correctness; each snippet has one deliberate not-a-bug.

**A. React AlertsPanel.** Token in query string (belongs in `Authorization` header; also in `localStorage`, XSS-readable). `dangerouslySetInnerHTML` on server data = stored XSS. Mutating state then `setAlerts(alerts)` with the same reference = React bails, no re-render. `customerId` missing from deps = shows the previous customer's data (multi-tenant leak). No abort/cleanup = out-of-order responses. No `res.ok` = permanent spinner. `useState<any>`. `new Date(a) - new Date(b)` does not compile. Nits: index keys, `<div onClick>`, no optimistic rollback. **Not a bug:** `.filter().sort()` is safe because `filter` returns a new array.

**B. Lambda + Mongo.** MongoClient constructed and closed inside the handler (belongs at module scope, never `close()`). `customerId` from the query string with no authorization = IDOR; tenant comes from the authorizer context. No try/catch. `customer` never null-checked (404). `_id` ObjectId vs string mismatch returns null forever. N+1 twice (`$in` or `$lookup`). Unbounded result (Lambda 6 MB, API GW 10 MB). Nits: no structured logging, secrets source, no indexes visible.

**C. `forEach(async)` fan-out.** `forEach` ignores returned promises: nothing is awaited, "Sent 0 of N", Lambda may freeze mid-send. Fix is `Promise.allSettled` over `map`, not `Promise.all` (which loses partial results). No idempotency for redelivery. Nit: SES rate limits, chunk.

**D. Aggregation.** `$match` after `$lookup`/`$unwind` joins every alert for every tenant first; move it to stage one so it uses the index. `$push: '$$ROOT'` unbounded and unneeded for a count. `$unwind` silently drops alerts with no matching law. **Not a bug:** `$lookup` itself; it is misplaced and unused.

**E. Mantine form.** `fetch` not awaited, no `res.ok`: shows "Acknowledged!" regardless. Missing `Content-Type: application/json`. No in-flight state, double submit. Nits: native `alert()`, `acknowledgedBy` as free text instead of the authenticated user. **Not a bug:** the `useForm` / `getInputProps` wiring is correct.

**F. Load-more table.** Stale closure `setLocations([...locations, ...])`; functional updater fixes it (adding the dep would loop). "Total across all locations" sums only loaded pages; total must come from the server. No error handling, no end-of-data guard, double-click duplicates. **Not a bug:** `key={loc.id}`.

**G. Playwright test.** Module-level `alertId` shared between tests (parallel workers, any order). `waitForTimeout` as synchronization. Missing `await` on `expect(locator).toHaveText`, so the test cannot fail. Brittle CSS selectors instead of `getByRole`/`getByLabel`. `text=Acknowledge` substring-matches "Acknowledged". Nits: hard-coded URL instead of `baseURL`, `getAttribute` returns `string | null`, one-shot `count()` assertion. **Not a bug:** `toHaveText` is the right matcher.

---

## 4. Sunday (React) and Monday (backend) — whiteboard scenarios [`frontend-whiteboard.md`, `whiteboard-walkthrough.md`, tech-panel §3]

**React Locations dashboard [frontend-whiteboard.md], most likely.** Up to 5,000 locations, so server-side paging and filtering. Tree: `LocationsPage` → `FiltersBar`, `LocationsTable` (rows with `StatusBadge`, icon plus text), `Pagination`, `LocationDrawer` → `AlertsList` → `AcknowledgeModal` (Mantine `useForm`). **State:** list and alerts in React Query; search/filter/page/selected id in URL search params (shareable, back button, deep links from emails); drawer/modal open in local state; user/tenant in context. Debounce search 300 ms. **Contract:** `GET /locations?search&status&page&pageSize → {items,total}`, `POST /alerts/:id/ack {note}`, `acknowledgedBy` set server-side. **States:** skeleton rows; two empty messages (none vs no matches); inline error with retry; optimistic ack with rollback via `onMutate/onError/onSettled`, then invalidate the list. **Perf:** pagination first, virtualize (`@tanstack/react-virtual`) only if infinite list, lazy-load drawer and modal, memo after profiling. **A11y:** real table semantics, `<button>` not clickable rows, focus trap in modal (Mantine does it), `aria-live` on success, card layout under `sm`. **Tests:** Vitest on query-string builder; RTL + MSW on skeleton/empty/rollback; one Playwright journey with `getByRole` and `page.route`. **Rejected:** client-side filtering, filters in `useState`, hand-rolled effects, pessimistic ack.

**Law-change notification system [whiteboard-walkthrough.md].** Clarify: who detects (internal editorial tool), latency (minutes to hours), volume (thousands of customers), audit proof needed. Flow: editorial writes an append-only `law_changes` record → Matcher Lambda runs an indexed prefix query on `locations.jurisdictionPath` → publishes to EventBridge/SNS → SQS one job per (customer, channel) → Notifier Lambdas send via SES and write `notifications` → delivery callbacks update status → React dashboard reads `{tenantId, acknowledged:false}` sorted by date. **Why not in the request path:** fan-out cannot fit API Gateway's window; the queue gives retries and backpressure. **Idempotency:** unique index on `customerId:lawChangeId:channel`. **Indexes:** `{jurisdictionPath:1}`, `{tenantId:1, acknowledged:1, effectiveDate:-1}` (ESR). **Failures, ranked for this domain:** a missed notification is worse than a duplicate, so at-least-once plus dedupe. Email down: queue drains. Bad record fanned out: kill switch, audit trail, `supersedes` correction. Wrong jurisdiction mapping: worst failure, reconciliation jobs. Poison messages: max receive → DLQ, alarm on depth. **Rejected:** synchronous fan-out, exactly-once, denormalizing affected customers onto the change (goes stale).

**Poster document storage.** S3 with versioning, metadata in Mongo, short-lived pre-signed URLs (never proxy bytes through Lambda), tenant-scoped prefixes, append-only `document_access` audit collection, CDN for shared assets. Documents are immutable versions with effective-date ranges.

**40k-row bulk import.** Browser uploads direct to S3 via pre-signed URL (6 MB Lambda limit) → S3 event → Lambda chunks rows onto SQS → workers `bulkWrite` batches → per-row errors collected into a downloadable report, never fail the whole job → import-status record the UI polls → idempotent re-runs. 15-minute Lambda ceiling is why you chunk; Step Functions or Fargate if a chunk cannot fit.

**Domain framing for all of them:** GovDocs = employment-law compliance; the hard problem is jurisdictional variance (federal → state → local) times change over time. Model laws as append-only versions with `effectiveFrom`/`effectiveTo`, never in-place edits, so you can reconstruct what was true on any date.

---

## 5. Monday — live-coding warm-ups [`coding-warmups.md`]

1. `debounce(fn, ms)` with `clearTimeout`/`setTimeout`; debounce waits for quiet, throttle caps the rate.
2. `useDebouncedValue(value, ms)`: effect sets a timer, cleanup clears it, deps `[value, ms]`.
3. `groupBy(items, keyFn)` via `reduce` and `(acc[k] ??= []).push(item)`. O(n).
4. `useFetch<T>(url)`: `AbortController` in cleanup, `res.ok` check, discriminated `status` state, ignore `AbortError`.
5. Affected tenants by jurisdiction prefix: compare with a trailing slash so `US/MN` does not match `US/MNX`; in Mongo, anchored regex on an indexed field.
6. `dedupeBy(items, keyFn)` with a `Map`; later wins, order of first appearance.
7. `flatten(tree)` recursively building `US/MN/Hennepin` paths with `flatMap`.
8. Event loop prediction: sync → microtasks in queue order → macrotask. The file's puzzle prints `1 6 8 3 5 7 4 2`.
9. `page(items, n, size)` returning `{items, total, hasMore}`.

Say Big-O after each. A finished `for` loop beats an unfinished `reduce`.

---

## 6. Monday (deep files) and Tuesday (rapid-fire, fundamentals, tooling) — topic digests

### React — Mon `react-typescript-review.md`, Tue `basics-rapid-fire.md`
- Re-renders on: state change, new props, parent render, context change. Compared with `Object.is`, so a new object or array identity counts. Same reference passed to a setter = bail, no render.
- Effects capture the values of their render; omit a dep and you have a stale closure. Cleanup cancels in-flight work. Strict Mode double-invokes in dev only. Prefer React Query for server state.
- Handler vs effect: user action → handler; syncing with something external → effect.
- Keys: index keys break on reorder, filter, insert. Use a stable id.
- Memoize when the child is expensive or the value feeds a deps array; otherwise noise. Measure with the Profiler first.
- Global state: server data → React Query; rare-change UI → Context (split and memoize the value); frequent or many writers → Zustand; large app with middleware → Redux Toolkit.
- Error boundaries catch render errors in their subtree, not handlers or async; use `react-error-boundary`; one per route.
- Portals for modals and drawers; `React.lazy` + `Suspense` for route bundles; React Router `useSearchParams` is how filters live in the URL.
- Controlled inputs for validate-as-you-type. Forms: where validation lives, how server errors map back to fields.
- A11y: `<button>` not `<div onClick>`, label every input, visible focus, not color alone, never render server strings as HTML.
- React 18: automatic batching, `useTransition`, `useId`. React 19: `ref` as a prop, `use()`, `useOptimistic`, form Actions. Ask which version they run.

### TypeScript — Mon `react-typescript-review.md`, Tue `basics-rapid-fire.md` and `frontend-fundamentals.md`
- `unknown` forces narrowing; `any` disables checking. API data lands as `unknown` and is validated with Zod. Types are erased at runtime; that is why runtime validation exists.
- Discriminated union + `const _: never = x` exhaustiveness is the highest-signal answer. Have the `Alert` example ready.
- `as` asserts, does not prove. Prefer type guards (`x is Alert`, `in`, `typeof`, `instanceof`).
- `as const` + `typeof X[number]` derives a union from a list. Prefer string-literal unions over enums. `satisfies` checks without widening.
- `strict` turns on `strictNullChecks`; "object is possibly undefined" is a real bug being caught. `noUncheckedIndexedAccess` if you want to sound careful.
- Utility types: `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited`. Generics: describe a real one you wrote (`get<T>(url)`, `useFetch<T>`).
- `interface` vs `type`: one sentence, interfaces merge, aliases do unions. Event types: `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`.

### JavaScript async and HTTP — Mon `js-async-http-fundamentals.md`
- Single thread, event loop. All microtasks (Promise callbacks, `await` continuations) drain before the next macrotask (`setTimeout`). `A D C B` for the classic four-liner.
- `Promise.all` rejects fast; `allSettled` tolerates partial failure (fan-out); `race` first settle; `any` first success.
- `forEach(async)` does not await. `for...of` sequential, `map` + `Promise.all` parallel. The real fix for a query loop is usually one batched query.
- Closures power hooks and the stale-closure bug. Arrow functions capture `this`. `??` vs `||`. Spread is shallow.
- Idempotent: GET, PUT, DELETE. POST is not, hence idempotency keys. 401 who you are, 403 what you may do, 404 not 500 for a missing resource, 409 conflict, 429 rate limited.
- Auth in the `Authorization` header, never the query string. CORS: server opts in, preflight for non-simple requests, protects the user not your API. `ETag`/304 caching. JWT vs session cookie tradeoffs.

### MongoDB — Mon `mongodb-review.md`
- Embed when bounded and always read together; reference when unbounded, shared, or independently queried. 16 MB document limit.
- Prefix rule: `{a:1, b:-1}` serves `a` and `a+b`, not `b` alone. ESR: Equality → Sort → Range.
- `explain('executionStats')`: IXSCAN vs COLLSCAN, `totalDocsExamined` close to `nReturned`, covered query when docs examined is 0.
- Aggregation: `$match` first so it uses the index, `$limit` early, `$match` before `$lookup`. `$facet` for results plus count. Sort is in-memory past 100 MB without `allowDiskUse`.
- N+1 → `$in` or `$lookup`. Range pagination over `skip`. `bulkWrite` for imports. `upsert` for idempotency. `_id` ObjectId vs string.
- Multi-tenant: tenant id first in every compound index and a non-optional filter on every query, enforced in a data-access layer, sourced from auth context.
- Index types: compound, multikey, text, TTL, partial, unique. Replica sets, `w: 'majority'`, read preference. Transactions exist; a good document model rarely needs them.
- "Why Mongo over Postgres": nested documents read whole, variable schema across 1,500 posting types, fast schema iteration; the cost is that joins and integrity move into your application layer. Bridge from your SQLite API.

### Lambda and AWS — Mon `lambda-aws-review.md`
- Init phase runs module scope once per execution environment; the handler runs every invocation. DB client at module scope, never `close()`.
- Cold start = package download + runtime init + module code. Reduce with smaller bundles, work moved into module scope, provisioned concurrency (paid while idle).
- Scales horizontally, so each environment has its own pool and a fixed-size database gets exhausted. Small `maxPoolSize`, reserved concurrency, RDS Proxy for relational.
- Memory and CPU are coupled; more memory can be cheaper. Lambda 15 min max; API Gateway 29 s by default. Longer work goes async with a status endpoint.
- Sync sources (API GW) do not retry; async (S3, SNS, EventBridge) retry twice then DLQ; SQS retries to max receive count then DLQ. Handlers must be idempotent: dedupe key with unique index, conditional writes, `upsert`. SQS batches: catch per record, return `batchItemFailures`.
- Payloads: 6 MB Lambda, 10 MB API GW. Big uploads go direct to S3 via pre-signed URL.
- Narration order when walking a Lambda: connection lifecycle → auth and tenant source → null checks → query shape → error handling → logging.
- Observability: structured JSON logs with `awsRequestId`, CloudWatch throttles and errors, DLQ depth alarm, X-Ray or Datadog APM.
- Security: tenant from verified context, secrets from Secrets Manager, least-privilege role, validate `event`.

### CSS, browser, security — Tue `frontend-fundamentals.md`
- `box-sizing: border-box` globally. Flex is one-dimensional and content-driven; Grid is two-dimensional and layout-driven. `rem` for type and spacing, `dvh` over `100vh`. Modal behind header = stacking context.
- Render path: DOM + CSSOM → render tree → layout → paint → composite. Animate `transform` and `opacity`. React batches DOM writes.
- Debounce vs throttle. `localStorage` vs `sessionStorage` vs cookies vs IndexedDB; tokens not in `localStorage`.
- CSRF: cookies are auto-sent, defend with `SameSite` and tokens; bearer headers are immune to CSRF but exposed to XSS; httpOnly cookies are the reverse. CSP as the strong XSS mitigation. IDOR is the backend twin.
- Core Web Vitals: LCP under 2.5 s, INP under 200 ms, CLS under 0.1. Levers biggest first: ship less JS, lazy images with dimensions, cache, paginate, then memoize.

### Testing — Tue `frontend-fundamentals.md`, `tooling-review.md`
- RTL: query by role and label, test behavior not internals. MSW mocks at the network layer.
- Pyramid: many unit tests on pure functions, some component tests, few Playwright journeys.
- Playwright: auto-waiting, `getByRole`, web-first assertions must be awaited, fresh context per test, `page.route` to stub, trace viewer. Never fix flaky tests with a sleep.
- Testing a Lambda: inject `db`, assert 401 / 404 / 200 and the response shape; integration against local Mongo in CI.
- Coverage shows what is untested, not what is well tested.

### Tooling — Tue `tooling-review.md`
- Mantine: components + `@mantine/hooks` (`useDisclosure`, `useDebouncedValue`, `useMediaQuery`) + `useForm` (`initialValues`, `validate`, `getInputProps`, `onSubmit`). v7+ uses CSS Modules and `classNames`/`styles`; `sx` and Emotion were removed. Ask which version.
- Datadog: metrics, logs, traces; the value is correlating them. Four golden signals: latency, traffic, errors, saturation. Alert on symptoms, not causes. SLI vs SLO.
- CI/CD: checkout → install → lint + typecheck → unit → build → Playwright → staging → smoke → prod. Blue/green, canary, feature flags. Infra as code for Lambdas.
- "Have you used X?": say so honestly, bridge to the equivalent you know, show you understand why it exists.

### Git — Tue `basics-rapid-fire.md`
- Working tree → index → commit → branch pointer → `HEAD`. `fetch` downloads; `pull` is fetch plus merge.
- `reset --soft` keeps staged, `--mixed` keeps unstaged, `--hard` discards; unpushed only. Pushed: `revert`. `--amend` for the last message. `reflog` recovers a lost commit.
- Merge keeps history; rebase rewrites for a linear one; never rebase a shared branch; squash-merge PRs. `--force-with-lease` over `--force`.
- Conflict: `git status` → fix markers → `add` → `commit` or `rebase --continue`; `--abort` to back out. `stash`, `cherry-pick`, `bisect`, `rm --cached` for an already-tracked file.
- Conventional commits (`feat:`, `fix:`), small PRs, and your review method when asked how you review.

### Cross-cutting — Tue `basics-rapid-fire.md`, tech-panel §2
- "What happens when a user loads this page" in 90 seconds: browser → CDN → API Gateway → Lambda cold or warm → auth → Mongo, indexed? → response → React render.
- Debugging across the stack: reproduce → find the layer with the network tab → follow the correlation id → narrow inside the layer → fix the cause → write the regression test → prevent the class.

---

## 7. Tuesday — culture panel [`culture-panel-prep.md`]

Nick listens for how you work with people whose data you depend on: handoffs, schema disagreements, data-quality bugs found downstream. Dan listens for fuzzy requirements, scope pushback with an alternative, saying no well. Aim at least one story at each.

**Seven stories, STAR, two minutes each, result with a number:** drove a project end to end including post-launch → hard bug across the stack (front-end symptom, backend cause) → disagreement with a teammate → a time you were wrong and what you changed (non-negotiable) → mentoring or being mentored (this is a mentored role) → working with product or design → learned something new fast.

**Raw material:** Augeo production work (at least four of the seven), the AWS labs, the Express/SQLite API and its written stack decision, the `wes` agent project, and coming back to GovDocs itself.

**Questions to rehearse:** tell me about yourself in 90 seconds (what you do → a highlight → why this role); why GovDocs; what changed since last year; where else are you interviewing; a time you received hard feedback; competing priorities; a weakness with a concrete fix; how you review code; how you work with people outside engineering; what feedback you have on their process.

**Why GovDocs hooks:** 2024 Best Places to Work (Minneapolis/St. Paul Business Journal), 18% annual growth since 2008 with 96% retention, a first-to-market compliance SaaS still being shaped, hybrid and mentored.

---

## 8. Tuesday — questions to ask [`culture-panel-prep.md`, `personal/gov_docs_questions.md`]

**Patrick and Ben:** front-end architecture and Mantine version; testing culture and where Playwright has gaps; the most interesting problem right now; how code gets from laptop to production and who is on call; the hands-on versus technical-leadership split.

**Nick:** how jurisdiction and law-change data is modeled and kept current; where data engineering hands off to product engineering.

**Dan:** how product and engineering scope together; how the next compliance capability gets chosen; who decides what gets built; how he has enjoyed his time.

**Alex:** the first 90 days and the problem this hire owns; how mentors are paired; Posting Service versus SaaS time split; the biggest technical debt and appetite to pay it down; what separates people who do well here from those who struggle; the hardest part of managing this team; how the team uses AI tooling and what guardrails exist given the compliance domain; headcount trend over two years; next steps and timeline; anything about your background to expand on.

---

## 9. Wednesday — the room [`cheat-sheet.md`]

The schedule lives in §0. Wednesday morning: `cheat-sheet.md` only. Confirm the address, arrive early, eat before 2:00, bring printed questions, a pen, and your two numbers.

**In the room:** twenty minutes per section means they expect unfinished, well-reasoned answers. Narrate what you are weighing. Say what is right, not only what is wrong. Pause before answering. Two or three real questions for every interviewer. You have done this interview before, and you came back on purpose.
