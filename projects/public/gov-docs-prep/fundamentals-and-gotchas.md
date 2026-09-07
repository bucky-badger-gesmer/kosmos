# Fundamentals and Gotchas — Bird's-Eye Review

Five topics, one file, minimal code. Each section is: what it is in one paragraph, the concepts to have straight, and the classic gotchas interviewers reach for. MongoDB gets the most room on purpose.

---

## React

**What it is.** A library for describing UI as a function of state. You write components that return what the screen should look like for the current state; React diffs that description against the last one and updates only the DOM nodes that changed. Everything else (routing, data fetching, forms) is ecosystem.

### Concepts to have straight
- **Components, props, state.** Props come from the parent and are read-only. State is owned by the component and changed only through its setter. Either changing triggers a re-render.
- **Rendering.** A render is React calling your function again. Four causes: your state changed, your props changed, your parent rendered, a context you read changed.
- **Reconciliation and keys.** React matches list items across renders by `key`. A stable id is the key; the array index is not.
- **Hooks.** `useState` for state, `useEffect` for syncing with something outside React, `useRef` for a value that persists without rendering, `useMemo`/`useCallback` for stable identities, `useContext` for shared read-mostly data, `useReducer` for state with many transitions. Custom hooks are just functions that call hooks.
- **Effects are for synchronizing, not for responding to clicks.** If a user action causes it, it goes in the handler. Effects are for subscriptions, timers, and "fetch because this is on screen."
- **Where state lives.** Server data: React Query or SWR. Filters and selection: the URL. Ephemeral UI: local state. Current user, theme, tenant: context. Reach for Zustand or Redux only when Context and React Query hurt.
- **Controlled inputs.** `value` + `onChange`. React owns the value; you can validate as the user types.
- **Error boundaries, portals, code splitting.** Boundary per route so one panel cannot blank the app. Portals for modals. `React.lazy` + `Suspense` for route bundles.
- **Accessibility basics.** Real `<button>`s, labeled inputs, visible focus, not color alone, no server strings as HTML.

### Classic gotchas
1. **Mutating state and setting it back.** React compares by reference. Same reference means "nothing changed," no re-render. Always make a new object or array.
2. **Missing dependency in `useEffect`.** The effect captured values from the render it ran in. Leave a prop out of the deps and the effect keeps using the old one forever. The lint rule exists because this bug is silent.
3. **No cleanup on a fetch effect.** Two quick prop changes, two requests, the slow one lands last and you show the wrong data. Cleanup with `AbortController` or an `ignore` flag.
4. **Index as key.** Works until the list is filtered, sorted, or has an item inserted; then inputs and component state jump to the wrong row.
5. **"My effect runs twice."** Strict Mode in development mounts, unmounts, and remounts to surface missing cleanup. Not a production bug.
6. **`setState` is not synchronous.** Reading state right after setting it gives the old value. Use the functional updater `setX(prev => ...)` when the next value depends on the previous one.
7. **New object in a dependency array or a memoized child's props.** `useEffect(() => ..., [{ id }])` fires every render because the literal is new every time. Pass primitives, or memoize the object.
8. **Over-memoizing.** `useMemo` on a cheap calculation costs more than it saves. Profile first.
9. **`<div onClick>`.** Not focusable, no role, invisible to keyboard and screen-reader users. Use a `<button>`.
10. **Stale closure in a timer or subscription.** A `setInterval` callback set up once sees the state from that first render. Use a ref or re-subscribe on change.
11. **Async state after unmount.** A resolved promise calling a setter on an unmounted component. The abort or ignore flag from gotcha 3 handles this too.
12. **Keys reset state.** Changing a component's `key` deliberately remounts it. Useful trick; accidental footgun.

---

## TypeScript

**What it is.** A static type layer on JavaScript. The compiler checks your code, then erases the types. At runtime there is no TypeScript, which is why data arriving from an API still needs runtime validation.

### Concepts to have straight
- **Inference.** Most variables need no annotation. Annotate function parameters, public return types, and anything that starts empty (`useState<Alert[]>([])`).
- **Unions and narrowing.** `A | B` is one or the other. You narrow with `typeof`, `in`, `instanceof`, `Array.isArray`, a literal discriminant field, or a custom type guard (`x is Alert`).
- **Discriminated unions.** A shared literal field (`kind: 'minWage' | 'paidLeave'`) lets `switch` narrow each branch. Add `const _: never = x` in `default` and a missing case becomes a compile error.
- **`unknown` vs `any`.** `unknown` is "I don't know yet, prove it before use." `any` is "stop checking." API responses land as `unknown` and go through Zod.
- **Generics.** A type parameter so one function works for many shapes. `function first<T>(xs: T[]): T | undefined`. Constrain with `extends`. Have a real one you wrote ready to describe.
- **Utility types.** `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited`. `keyof T` for property names, `T['field']` for a property's type, `typeof ARR[number]` to derive a union from a const array.
- **`interface` vs `type`.** Interfaces merge and suit object contracts; aliases do unions and mapped types. One sentence, move on.
- **Strict mode.** `strict: true` turns on `strictNullChecks` and friends. Most "TypeScript is annoying" is a real null bug being caught.
- **Structural typing.** Shapes match, names don't matter. Object literals get extra-property checks; variables don't.

### Classic gotchas
1. **`as` is not a check.** `data as Alert` tells the compiler to trust you. If the shape is wrong, the error appears somewhere far away. Prefer guards or validation.
2. **`!` is not a check either.** `process.env.MONGO_URI!` compiles; at runtime it is still `undefined` if unset. Validate config at startup.
3. **Types are erased.** `if (typeof x === 'Alert')` is meaningless. You cannot check a TypeScript type at runtime; you check a discriminant or validate.
4. **`Object.keys` returns `string[]`**, not `(keyof T)[]`. Expected, annoying, and asked about.
5. **Arithmetic on `Date`.** `new Date(a) - new Date(b)` does not compile. Use `.getTime()`.
6. **`getAttribute`, `find`, `[i]` return `T | null` or `T | undefined`.** Assigning to `string` fails under strict. Handle the missing case.
7. **Enums.** Numeric enums accept any number; all enums emit runtime code and round-trip poorly through JSON. Prefer string-literal unions.
8. **Excess property check only on literals.** `const x = { a: 1, extra: 2 }; fn(x)` passes; `fn({ a: 1, extra: 2 })` fails. Knowing why (structural typing) is the point.
9. **Optional vs `undefined`.** `field?: string` allows omission; `field: string | undefined` requires the key. `exactOptionalPropertyTypes` tightens this.
10. **`any` spreads.** One `any` in a chain silently un-types everything downstream. Find where it enters, usually an untyped `fetch` or JSON parse.
11. **Type vs value namespace.** You can `import type` something and not have it at runtime. Zod solves this by being both: `z.infer<typeof schema>` gives the type, `schema.parse` the runtime check.
12. **"Type 'X' is not assignable to type 'Y'."** Read both types fully before touching anything. The fix is usually at the wider type, not a cast at the call site.

---

## MongoDB

**What it is.** A document database. Records are JSON-like documents (BSON) in collections, no fixed schema enforced by the server unless you add validation. You model around how data is read, not around normalization. Indexes work like any database: without one, a query scans the whole collection. The aggregation pipeline is Mongo's query language for anything beyond "find documents matching a filter": you push documents through a sequence of stages, each transforming the stream.

### Concepts to have straight

**Documents and modeling**
- **Embed vs reference.** Embed when the child is bounded and always read with the parent (a location's address, a customer's small list of jurisdictions). Reference (store an id) when the child is unbounded, shared across parents, or queried on its own (law records, notification history). The 16 MB document cap is the hard limit; an array that grows forever is a modeling bug.
- **`_id`.** Every document has one, an `ObjectId` by default (12 bytes, roughly time-ordered). You can use your own string ids.
- **Schema lives in your code.** Types plus Zod, or Mongo's JSON Schema validator on the collection. "Schema-flexible," not "schemaless."
- **Versioning over time.** For compliance data, never update a law in place. Insert a new version with `effectiveFrom` / `effectiveTo` so you can answer "what was true on date X."

**Querying**
- **`find(filter, options)`** returns a cursor. `.project()` to pick fields, `.sort()`, `.skip()`, `.limit()`, `.toArray()`.
- **Operators.** Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`. Logical: `$and`, `$or`, `$not`. Field: `$exists`, `$type`. Array: `$all`, `$elemMatch`, `$size`. String: `$regex`.
- **Dot notation** for nested fields: `{ 'address.state': 'MN' }`. Matching an array field with a scalar matches if any element equals it.
- **Updates.** `updateOne` / `updateMany` with operators: `$set`, `$unset`, `$inc`, `$push`, `$addToSet`, `$pull`. `upsert: true` inserts if nothing matched. `findOneAndUpdate` returns the document. `bulkWrite` for many operations in one round trip.
- **Pagination.** `skip` walks the skipped documents and gets slower every page. Range pagination (`_id > lastSeenId`, or `effectiveDate < lastSeen`) stays fast.

**Indexes**
- **Types.** Single field, compound, multikey (automatic on arrays), unique, partial (index only documents matching a filter), TTL (auto-expire), text.
- **Prefix rule.** A compound index `{ tenantId: 1, effectiveDate: -1 }` serves queries on `tenantId`, and on `tenantId` + `effectiveDate`. It does not serve `effectiveDate` alone. Field order matters.
- **ESR rule** for field order: Equality fields first, then the Sort field, then Range fields. Query `{ tenantId, acknowledged: false }` sorted by `effectiveDate` wants `{ tenantId: 1, acknowledged: 1, effectiveDate: -1 }`.
- **Covered query.** If the index contains every field the query filters on and returns, Mongo never reads the documents. `totalDocsExamined: 0`.
- **`explain('executionStats')`.** Look for `IXSCAN` (good) vs `COLLSCAN` (bad on anything large), and whether `totalKeysExamined` and `totalDocsExamined` are close to `nReturned`. Examining 100,000 to return 10 means the index is not selective.
- **Unique index as a tool.** It is how you enforce idempotency: a dedupe key like `customerId:lawChangeId:channel` with a unique index makes a retried write fail harmlessly.

**Aggregation pipeline, stage by stage (the part to get comfortable with)**

Think of it as Unix pipes for documents. Each stage receives a stream of documents and emits a stream. Order matters for both correctness and speed.

| Stage | What it does | Plain-English analogy |
|---|---|---|
| `$match` | Keep documents matching a filter | `WHERE` |
| `$project` | Pick, drop, rename, or compute fields | `SELECT a, b, a+b AS c` |
| `$addFields` / `$set` | Add computed fields, keep the rest | `SELECT *, a+b AS c` |
| `$group` | Collapse many documents into one per key, with accumulators | `GROUP BY` |
| `$sort` | Order the stream | `ORDER BY` |
| `$limit` / `$skip` | Take or skip N | `LIMIT` / `OFFSET` |
| `$lookup` | Pull matching documents from another collection into an array field | `LEFT OUTER JOIN` (result is an array) |
| `$unwind` | Turn one document with an array of N into N documents | Flattening a join |
| `$count` | Emit a single document with the count | `SELECT COUNT(*)` |
| `$facet` | Run several sub-pipelines on the same input in one pass | Several queries at once (results + total) |
| `$bucket` / `$bucketAuto` | Group into ranges | Histogram |
| `$out` / `$merge` | Write results to a collection | `INSERT INTO ... SELECT` |

**`$group` accumulators:** `$sum` (use `$sum: 1` to count), `$avg`, `$min`, `$max`, `$first`, `$last`, `$push` (collect into an array), `$addToSet` (collect unique). The group key is `_id`; `_id: null` groups everything into one document.

A typical shape, "unacknowledged alerts per jurisdiction for one tenant, largest first":

```js
db.alerts.aggregate([
  { $match: { tenantId, acknowledged: false } },   // 1. filter first, uses the index
  { $group: { _id: '$jurisdiction', count: { $sum: 1 } } },  // 2. one doc per jurisdiction
  { $sort: { count: -1 } },                         // 3. order the groups
  { $limit: 20 },                                   // 4. bound the result
]);
```

Field references inside stages are strings with a `$`: `'$jurisdiction'` means "the value of the jurisdiction field." `'$$ROOT'` is the whole document. Expression operators (`$concat`, `$cond`, `$dateToString`, `$arrayElemAt`, `$size`) compute values inside `$project`, `$group`, and `$addFields`.

**Operations, awareness level**
- **Replica set.** One primary, several secondaries, automatic failover. Reads default to the primary.
- **Write concern** `w: 'majority'` waits for durability across nodes. **Read preference** `secondary` scales reads at the cost of possible staleness.
- **Transactions** exist across documents on replica sets. The idiom is to model so you rarely need them: data that changes together lives in one document, and single-document writes are always atomic.
- **Atlas** is the managed service. Connection limits per tier are why Lambda connection reuse matters.
- **Change streams** let you subscribe to inserts and updates, the trigger for the notification-system whiteboard.

### Classic gotchas
1. **`$match` late in the pipeline.** Only a `$match` at the start (or right after another `$match`/`$sort` the optimizer can move) uses indexes. A `$match` after `$lookup` joins the entire collection first. Filter first, always.
2. **`_id` type mismatch.** Documents store `ObjectId`; you query with the string from a URL. Returns nothing, no error, looks like missing data. Convert with `new ObjectId(str)` (wrap it; it throws on bad input) or store string ids consistently.
3. **N+1 queries.** A loop doing one `findOne` per item. Replace with a single `$in` query or a `$lookup`.
4. **`$unwind` drops documents.** If the array is empty or missing, the document disappears unless you pass `preserveNullAndEmptyArrays: true`. A `$lookup` that finds no match yields an empty array, so the following `$unwind` silently deletes the parent. Undercounts come from here.
5. **`$push: '$$ROOT'` in a `$group`.** Collects entire documents into an array; on a large group it hits the 16 MB limit. Push only the fields you need, or don't push at all for a count.
6. **The prefix rule surprise.** Index `{ a: 1, b: 1 }` exists, query on `b` alone is a collection scan. People assume "b is indexed."
7. **Sort without a supporting index.** In-memory sort, capped at 100 MB, then an error unless `allowDiskUse`. Put the sort field in the index in ESR position.
8. **`skip` pagination on deep pages.** Page 500 walks 500 pages of documents. Use range pagination.
9. **Unbounded queries.** No `limit`, no projection. Fine in dev with 40 documents, fails for the largest customer in production, especially behind Lambda's 6 MB response cap.
10. **Missing tenant filter.** Every query in a multi-tenant system needs the tenant id, and it must come from the authenticated context, not the request. Enforce it in one data-access layer, not at every call site.
11. **Multikey compound index limit.** A compound index can include at most one array field.
12. **`updateOne` without operators.** `updateOne({ _id }, { name: 'x' })` is an error in modern drivers; you must use `$set`. `replaceOne` is the whole-document replacement.
13. **Regex without an anchor.** `{ path: /MN/ }` scans; `{ path: /^US\/MN/ }` can use an index. Anchor prefix searches.
14. **Case-insensitive matching.** `$regex` with `i` cannot use a normal index efficiently. Store a normalized lowercase field, or use a collation.
15. **Connection per request.** Opening a `MongoClient` per handler call, especially in Lambda. Construct once at module scope and reuse.

---

## AWS Lambda

**What it is.** Functions that run on demand in short-lived execution environments. You upload code and a handler; AWS starts an environment on the first request, runs your module-level code once, then calls the handler for each event. Idle environments are reused ("warm") and eventually torn down. You pay per invocation and per GB-second. You do not manage servers, and you also do not control how many environments exist.

### Concepts to have straight
- **Lifecycle.** Init (download package, start runtime, run module scope) happens on a **cold start**. Invoke (the handler) happens every call. Module scope is your place for connections, clients, and config.
- **Cold starts.** Cost of init. Shrink the bundle, import only the SDK clients you use, keep heavy setup at module scope so it amortizes, provisioned concurrency for latency-sensitive paths (you pay while idle).
- **Concurrency.** Each concurrent request gets its own environment. Scale-out is automatic. **Reserved concurrency** caps a function. Every environment has its own connection pool, so total DB connections = environments × pool size.
- **Memory and CPU are coupled.** More memory means more CPU. A higher memory setting often finishes faster and costs less.
- **Limits worth knowing.** 15 minute max duration. API Gateway waits 29 seconds by default. 6 MB synchronous response payload, 10 MB through API Gateway. 250 MB unzipped deployment (or container images to 10 GB).
- **Invocation types.** Synchronous (API Gateway, ALB, direct): caller waits, no automatic retry. Asynchronous (S3, SNS, EventBridge): Lambda queues it, retries twice, then a DLQ or failure destination. Poll-based (SQS, Kinesis, DynamoDB Streams): Lambda polls and hands you batches; SQS retries until success or max receive count, then the DLQ.
- **Idempotency.** Because retries exist, a handler must be safe to run twice: dedupe key with a unique index, conditional write, `upsert`, or an idempotency token.
- **Event and context.** `event` is the payload shaped by the source. `context.awsRequestId` is your correlation id; `context.getRemainingTimeInMillis()` for time budgeting.
- **Permissions.** An execution role (IAM) says what the function may call. Least privilege. Secrets from Secrets Manager or Parameter Store, not hardcoded.
- **Observability.** Structured JSON logs to CloudWatch with the request id. Metrics: invocations, errors, duration, throttles, concurrent executions. DLQ depth alarm. X-Ray or Datadog for traces across API Gateway → Lambda → database.
- **Deploy.** Infrastructure as code (SAM, CDK, Serverless Framework, Terraform). Versions and aliases for safe rollouts.

### Classic gotchas
1. **Creating the DB client inside the handler.** New TCP and TLS handshake every request, and under load the database runs out of connections. Client at module scope.
2. **Calling `client.close()` at the end of the handler.** You just threw away the warm connection the next invocation would reuse. Don't close.
3. **Forgetting to `await`.** The handler returns, the environment freezes, and your in-flight `ses.send` or database write may never complete. `forEach(async ...)` is the usual culprit.
4. **Non-idempotent handler on a retrying source.** Redelivered SQS message emails the same customer twice, or inserts twice. Dedupe key.
5. **Trusting the event for identity.** A `customerId` in the query string is not authorization. Tenant comes from the authorizer context or verified token.
6. **Returning the wrong shape to API Gateway.** The proxy integration needs `{ statusCode, headers, body: string }`. Forgetting `JSON.stringify` on the body is a 502 with a confusing log.
7. **Throwing without catching.** Unhandled throw = 502 with no useful log line. Wrap the handler, log structured context, return a clean 500.
8. **API Gateway's 29 seconds vs Lambda's 15 minutes.** Long work behind an HTTP endpoint times out at the gateway while the function keeps running. Make it async with a status endpoint or a queue.
9. **Payload limits found in production.** Unbounded result sets pass in dev and fail for the largest customer. Paginate, project, limit. Large uploads go straight to S3 via pre-signed URL.
10. **Pool size × concurrency.** A `maxPoolSize` of 100 with 200 concurrent environments asks Atlas for 20,000 connections. Keep pools small; consider reserved concurrency.
11. **SQS batch, one bad record.** Throwing fails the whole batch and retries the good records too. Catch per record and return `batchItemFailures`.
12. **Environment variables as secrets.** Visible in the console and in logs if you dump `process.env`. Use Secrets Manager or Parameter Store and fetch at module scope.
13. **`callbackWaitsForEmptyEventLoop = false`.** In old callback-style handlers with a persistent DB connection, this is the standard fix for a handler that never returns. It is not a bug when you see it.
14. **Time zones and clocks.** Lambda runs in UTC. Effective-date logic that assumes local time is wrong at midnight.

---

## Git and GitHub

**What it is.** Git is a content-addressed history of snapshots. Every commit points to a tree of files and to its parent commit. Branches are movable pointers to commits; `HEAD` is the pointer you have checked out. GitHub hosts remotes and adds the collaboration layer: pull requests, reviews, checks, Actions, branch protection.

### Concepts to have straight
- **Three areas.** Working tree (your files) → staging area / index (`git add`) → repository (`git commit`). `git status` tells you which is which.
- **Branches and HEAD.** Cheap pointers. `git switch -c feature` creates and checks out. Detached HEAD means you checked out a commit, not a branch; commits made there are lost when you leave unless you create a branch.
- **Remotes.** `origin/main` is your last-known copy of the remote branch. `fetch` updates that copy and touches nothing you have checked out. `pull` is `fetch` + `merge` (or `+ rebase` with `--rebase`).
- **Merge vs rebase.** Merge preserves history and adds a merge commit. Rebase replays your commits onto a new base for linear history and rewrites their SHAs. Rebase your own unpushed work; never rebase a branch others have.
- **Undo.** `reset --soft` (keep staged), `--mixed` (keep unstaged, the default), `--hard` (discard), for unpushed commits. `revert` makes a new inverse commit for anything already pushed. `commit --amend` fixes the last commit before pushing. `reflog` finds commits you thought were gone.
- **Conflicts.** `git status` lists them. Edit the `<<<<<<<` / `=======` / `>>>>>>>` blocks, remove the markers, `git add`, then `git commit` (merge) or `git rebase --continue` (rebase). `--abort` backs out either.
- **Everyday tools.** `stash` (shelve work, `-u` for untracked), `cherry-pick` (copy one commit), `bisect` (binary search for the commit that broke something), `blame`, `log --oneline --graph`, `diff --staged`.
- **GitHub workflow.** Branch off `main`, small commits, push, open a PR with a clear description, CI runs, review, squash-merge. Branch protection: required reviews, required status checks, no direct pushes to `main`. `CODEOWNERS` auto-requests reviewers. Draft PRs for early feedback.
- **GitHub Actions.** Workflows in `.github/workflows/*.yml`, triggered on `push`, `pull_request`, `schedule`. Jobs run on runners; steps run commands or reuse published actions. Secrets in repository settings. Cache `node_modules` by lockfile hash.
- **Commit hygiene.** Imperative subject under 50 characters, body says why. Conventional commits (`feat:`, `fix:`, `chore:`) if the repo uses them; yours do.
- **Reviewing a PR.** Correctness → security → tests → readability. Blocking vs nit. Question intent before criticizing. Approve, comment, or request changes; say which and why.

### Classic gotchas
1. **`pull` when you meant `fetch`.** Surprise merge commit, or a rebase you did not want. Fetch, look, then decide.
2. **Rebasing a shared branch.** Everyone else's copy now diverges; the next pull is a mess. Only rebase what nobody else has pulled.
3. **`push --force` over a teammate's work.** Use `--force-with-lease`, which refuses if the remote moved since you fetched.
4. **`reset --hard` on pushed commits.** History diverges from the remote. `revert` instead.
5. **`.gitignore` does not untrack.** A file already committed stays tracked. `git rm --cached file`, then commit.
6. **Committing secrets.** Removing them in the next commit does not remove them from history. Rotate the secret; rewriting history is secondary.
7. **Committing to the wrong branch.** Create a branch at the current commit to save the work, then reset the wrong branch to `origin/...`. Or cherry-pick onto the right branch.
8. **Detached HEAD commits.** Made a commit while checked out at a SHA or tag; switched away; gone from view. `reflog` finds it, `switch -c` keeps it.
9. **Merge commit noise vs lost context.** Squash-merge gives a clean `main` but loses the PR's individual commits. Pick one strategy per repo and stay consistent.
10. **Amend after push.** The remote has the old SHA; your amended commit is a new one. Requires a force push, so only amend unpushed commits.
11. **Long-lived branches.** Weeks of drift, giant conflicts, review fatigue. Small PRs merged often; feature flags for incomplete work.
12. **Large files.** A committed build artifact or dataset bloats every clone forever. `.gitignore` build output; Git LFS for real binaries.
13. **Line endings.** CRLF vs LF across Windows and Mac shows every line as changed. `.gitattributes` with `* text=auto`.
14. **CI passing on a stale merge base.** The PR's checks ran against an old `main`. "Require branches to be up to date before merging" in branch protection closes the gap.

---

## If you only remember one thing per topic

- **React:** state changes are compared by reference; effects capture the render they ran in.
- **TypeScript:** types are erased at runtime; `as` and `!` are promises you make, not checks the compiler does.
- **MongoDB:** `$match` first so the index is used; index field order follows the prefix rule and ESR.
- **Lambda:** module scope runs once and is reused warm; handlers must be idempotent because sources retry.
- **Git:** rewrite only what nobody else has; `revert` for shared history, `reflog` when you think something is lost.
