# GovDocs Tech Panel Prep — Sept 9, 2:00–3:00pm
Patrick Mazurek (SWE) + Ben Alman (Sr. SWE) · Code review · Tech questions · Whiteboarding

Roughly 20 minutes per part. Nothing here is solvable-or-fail; all three parts are scored on how you reason out loud.

---

## Part 1: Code review

Practice method: open the snippet, set a 10-minute timer, and talk through it out loud before reading the answer key. Say findings in this order — **correctness → security → error handling → performance → readability → testability** — and label each as *blocking* or *nit*. Open with a question about intent, not a criticism.

The last step, **testability**, is the one most candidates skip and the JD asks for twice ("well-tested code", Playwright). End every review with one sentence: *"The test I'd want here is ___."* For Snippet A that is a component test that the list refetches when `customerId` changes; for Snippet B it is a handler test with a missing customer returning 404. Say also what is *right* about the code. Naming a bug that is not there costs more than missing one.

### Snippet A — React + TypeScript

```tsx
// AlertsPanel.tsx
import React, { useState, useEffect } from 'react';

type Alert = {
  id: string;
  jurisdiction: string;
  effectiveDate: string;
  severity: string;
  acknowledged: boolean;
};

export default function AlertsPanel({ customerId }: { customerId: string }) {
  const [alerts, setAlerts] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/customers/${customerId}/alerts?token=${localStorage.getItem('authToken')}`)
      .then(res => res.json())
      .then(data => {
        setAlerts(data.alerts);
        setLoading(false);
      });
  }, []);

  const visible = alerts
    .filter((a: any) => a.jurisdiction.toLowerCase().includes(query.toLowerCase()))
    .sort((a: Alert, b: Alert) => new Date(a.effectiveDate) - new Date(b.effectiveDate));

  async function acknowledge(alert: Alert) {
    alert.acknowledged = true;
    setAlerts(alerts);
    await fetch(`/api/alerts/${alert.id}/ack`, { method: 'POST' });
  }

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {loading && <span>Loading…</span>}
      {visible.map((alert: Alert, i: number) => (
        <div key={i} onClick={() => acknowledge(alert)}>
          <span dangerouslySetInnerHTML={{ __html: alert.severity }} />
          {alert.jurisdiction} — {alert.effectiveDate}
        </div>
      ))}
    </div>
  );
}
```

**Answer key — blocking:**

1. **Auth token in a query string.** `?token=...` lands in server logs, browser history, and any proxy in between. Belongs in an `Authorization` header. Also worth asking why the token is in `localStorage` rather than an httpOnly cookie — XSS-readable.
2. **`dangerouslySetInnerHTML` on `alert.severity`.** Server-controlled string rendered as HTML is a stored-XSS path. `severity` should be a union type (`'low' | 'medium' | 'high'`) rendered as text or mapped to a class name.
3. **Mutating state in `acknowledge`.** `alert.acknowledged = true` mutates an object inside state, and `setAlerts(alerts)` passes the same array reference — React bails on the re-render, so the UI won't update. Needs `setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, acknowledged: true } : a))`.
4. **Missing `customerId` in the effect's dependency array.** If the prop changes, the component keeps showing the previous customer's compliance alerts. In a multi-tenant product that's a data-leak-shaped bug, not just a stale-UI bug.
5. **No cleanup and no abort.** Two rapid `customerId` changes can resolve out of order and render the wrong customer's data; resolving after unmount sets state on a dead component. Needs an `AbortController` in the cleanup function, or a stale-request guard.
6. **No error handling.** `res.ok` is never checked, so a 500 returning HTML throws inside `.json()`, the promise rejects unhandled, and `loading` stays `true` forever — permanent spinner. Needs `.catch` with an error state, or `try/finally`.
7. **`useState<any>([])` and `(a: any)`.** Defeats the point of TypeScript on the exact boundary where it matters most — untrusted server data. Should be `useState<Alert[]>([])`; the `Alert` type already exists, so this is just not being used.
8. **`new Date(a) - new Date(b)`** doesn't compile under TS — arithmetic on `Date`. Needs `.getTime()`. Good one to flag because it shows you actually read the types.

**Nits:**

- `key={i}` — index keys break when the filtered list reorders; use `alert.id`.
- `<div onClick>` for the primary action is inarguably wrong for accessibility — not keyboard-reachable, no role. Should be a `<button>`.
- No optimistic-update rollback: if the ack POST fails, the UI silently lies.
- `filter().sort()` recreated every render — technically fine at this list size; mention `useMemo` as a "if this grows" note, not a finding.

**Deliberate trap:** `.filter().sort()` is *not* a state-mutation bug — `filter` returns a new array, so sorting it is safe. Calling `alerts.sort()` directly would be the bug. Knowing which one is real is the thing that reads as senior.

**The fixed shape.** Every numbered finding above maps to a line here. Be able to sketch the effect and the `acknowledge` function from memory; the rest you can describe.

```tsx
// AlertsPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';

type Severity = 'low' | 'medium' | 'high';                       // #2: a union, never rendered as HTML

type Alert = {
  id: string;
  jurisdiction: string;
  effectiveDate: string;
  severity: Severity;
  acknowledged: boolean;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; alerts: Alert[] };

export default function AlertsPanel({ customerId }: { customerId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });  // #7: typed, no `any`
  const [query, setQuery] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();                            // #5: cancel stale requests
    setState({ status: 'loading' });

    fetch(`/api/customers/${customerId}/alerts`, {                 // #1: no token in the URL;
      signal: ctrl.signal,                                         //     auth via httpOnly cookie
      credentials: 'include',                                      //     or an Authorization header
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);        // #6: check the status
        return res.json() as Promise<{ alerts: Alert[] }>;
      })
      .then(data => setState({ status: 'success', alerts: data.alerts }))
      .catch(err => {
        if (err.name === 'AbortError') return;                     // cleanup ran, ignore
        setState({ status: 'error', message: err.message });       // #6: loading can't stick
      });

    return () => ctrl.abort();                                     // #5: cleanup
  }, [customerId]);                                                // #4: refetch on prop change

  const visible = useMemo(() => {
    if (state.status !== 'success') return [];
    const q = query.toLowerCase();
    return state.alerts
      .filter(a => a.jurisdiction.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()); // #8
  }, [state, query]);

  async function acknowledge(alert: Alert) {
    if (state.status !== 'success') return;
    const previous = state.alerts;

    // #3: new array, new object, functional updater — optimistic
    setState({
      status: 'success',
      alerts: previous.map(a => (a.id === alert.id ? { ...a, acknowledged: true } : a)),
    });

    try {
      const res = await fetch(`/api/alerts/${alert.id}/ack`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setState({ status: 'success', alerts: previous });           // nit: roll back, don't lie
      // surface an error toast here
    }
  }

  return (
    <div>
      <label htmlFor="alert-search">Filter by jurisdiction</label>
      <input id="alert-search" value={query} onChange={e => setQuery(e.target.value)} />

      {state.status === 'loading' && <span role="status">Loading…</span>}
      {state.status === 'error' && <p role="alert">Couldn't load alerts: {state.message}</p>}

      {state.status === 'success' && visible.length === 0 && <p>No alerts match.</p>}

      <ul>
        {visible.map(alert => (
          <li key={alert.id}>                                       {/* nit: stable id, not index */}
            <span className={`severity-${alert.severity}`}>{alert.severity}</span>  {/* #2: text */}
            {alert.jurisdiction} — {alert.effectiveDate}
            <button
              type="button"                                         /* nit: a real button */
              onClick={() => acknowledge(alert)}
              disabled={alert.acknowledged}
            >
              {alert.acknowledged ? 'Acknowledged' : 'Acknowledge'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Three things to say while sketching it:

- The `LoadState` union means loading, error, and success are mutually exclusive, so the permanent spinner from finding #6 cannot happen by construction. That is the same discriminated-union answer from the TypeScript questions, applied.
- In production you would replace the effect with React Query (`useQuery` keyed on `customerId`, `useMutation` with `onMutate`/`onError` for the optimistic ack). Say that, then say you wrote it by hand here to show you know what the library is doing for you.
- The `useMemo` is optional at this list size. It is there because `visible` is derived from state, and deriving during render is the point; if they push, agree it could be a plain `const`.

---

### Snippet B — Lambda + MongoDB

```ts
import { MongoClient } from 'mongodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  const client = new MongoClient(process.env.MONGO_URI!);
  await client.connect();
  const db = client.db('compliance');

  const customerId = event.queryStringParameters?.customerId;
  const customer = await db.collection('customers').findOne({ _id: customerId });

  const alerts = [];
  for (const j of customer.jurisdictions) {
    const found = await db.collection('alerts').find({ jurisdiction: j }).toArray();
    alerts.push(...found);
  }

  const enriched = await Promise.all(
    alerts.map(async (a) => ({
      ...a,
      law: await db.collection('laws').findOne({ _id: a.lawId }),
    }))
  );

  await client.close();

  return { statusCode: 200, body: JSON.stringify({ alerts: enriched }) };
};
```

**Answer key — blocking:**

1. **Client constructed inside the handler, and closed at the end.** This is the headline finding. Every invocation opens a fresh TCP + TLS handshake to Atlas, adds latency to every cold *and* warm start, and under concurrency spikes exhausts the cluster's connection limit. The client belongs at module scope so it's reused across warm invocations, and you never call `close()`.
2. **No authorization check.** `customerId` comes straight off the query string with no check that the caller is entitled to that customer. Classic IDOR — in a compliance product, that's one customer reading another's data. Tenant ID should come from the verified token/authorizer context, not user input.
3. **No `try/catch` anywhere.** An unhandled throw returns a 502 with no useful log line, and if you keep the per-invocation client, it leaks the connection too.
4. **`customer` is never null-checked.** Unknown ID → `customer.jurisdictions` throws `TypeError`. Should be a 404.
5. **`_id: customerId` type mismatch.** If `_id` is an `ObjectId`, matching against a raw string silently returns `null` forever — a bug that looks like "no data" rather than an error. Either cast with `new ObjectId()` (inside a try, since it throws on malformed input) or confirm `_id` is stored as a string.
6. **N+1, twice.** The loop should be one query with `$in: customer.jurisdictions`; the `laws` lookup should be a single `$in` batch or an aggregation `$lookup`. As written, a customer in 30 jurisdictions with 20 alerts each triggers 600+ round trips.
7. **Unbounded result set.** No `limit`, no pagination, no projection. Lambda's response payload caps at 6 MB and API Gateway at 10 MB — this fails in production for your largest customer only, which is the worst way to find out.

**Nits / follow-ups worth raising:**

- No structured logging or request ID, so this is undebuggable in production.
- Connection string read from an env var — ask whether it's coming from Secrets Manager or Parameter Store, and whether it's rotated.
- `alerts` is implicitly `any[]`.
- Missing indexes are invisible here: ask what indexes exist on `alerts.jurisdiction`.

**The fixed shape.** Every numbered finding maps to a tagged line. The connection lifecycle and the tenant check are the two parts to have from memory.

```ts
import { MongoClient, ObjectId, Db } from 'mongodb';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

// #1: module scope runs once per execution environment and is reused across warm
//     invocations. Small pool because Lambda scales out and every environment gets its own.
const client = new MongoClient(process.env.MONGO_URI!, { maxPoolSize: 10 });
const dbPromise: Promise<Db> = client.connect().then(c => c.db('compliance'));

type Alert = {
  _id: ObjectId;
  tenantId: string;
  jurisdiction: string;
  lawId: ObjectId;
  severity: 'low' | 'medium' | 'high';
  effectiveDate: Date;
  acknowledged: boolean;
};

type Law = { _id: ObjectId; title: string; jurisdiction: string };

const PAGE_SIZE = 100;

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const requestId = context.awsRequestId;                          // nit: correlation id for logs

  try {                                                            // #3: nothing escapes as a 502
    const db = await dbPromise;                                    // #1: reuse, never close()

    // #2: identity comes from the authorizer, which already verified the token.
    //     The query string is user input and can say anything.
    const auth = event.requestContext.authorizer ?? {};
    const tenantId: string | undefined = auth.tenantId;
    if (!tenantId) return json(401, { error: 'Unauthorized' });

    // #2 (variant): if a caller may legitimately view several customers, the URL can
    //     *request* one, but the server checks it against an allowlist it trusts.
    const requested = event.queryStringParameters?.customerId ?? tenantId;
    const allowed: string[] = auth.allowedCustomerIds ? JSON.parse(auth.allowedCustomerIds) : [tenantId];
    if (!allowed.includes(requested)) return json(403, { error: 'Forbidden' });

    // #5: _id is an ObjectId in this collection, so cast — and treat a malformed id as
    //     a client error rather than letting the constructor's throw become a 500.
    if (!ObjectId.isValid(requested)) return json(400, { error: 'Invalid customerId' });
    const customer = await db
      .collection<{ _id: ObjectId; jurisdictions: string[] }>('customers')
      .findOne({ _id: new ObjectId(requested) }, { projection: { jurisdictions: 1 } });

    if (!customer) return json(404, { error: 'Customer not found' });      // #4: null check → 404

    // #7: bounded. Page is a query param; default to page 1.
    const page = Math.max(1, Number(event.queryStringParameters?.page ?? 1) || 1);

    // #6: one query with $in replaces the per-jurisdiction loop; projection keeps the
    //     payload small; sort + skip + limit bounds it. Index: { tenantId: 1, jurisdiction: 1, effectiveDate: -1 }.
    const alerts = await db
      .collection<Alert>('alerts')
      .find({ tenantId: requested, jurisdiction: { $in: customer.jurisdictions } })
      .project<Pick<Alert, '_id' | 'jurisdiction' | 'lawId' | 'severity' | 'effectiveDate' | 'acknowledged'>>({
        jurisdiction: 1, lawId: 1, severity: 1, effectiveDate: 1, acknowledged: 1,
      })
      .sort({ effectiveDate: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();

    // #6: one batched lookup for the laws instead of one findOne per alert.
    const lawIds = [...new Set(alerts.map(a => a.lawId.toHexString()))].map(id => new ObjectId(id));
    const laws = await db
      .collection<Law>('laws')
      .find({ _id: { $in: lawIds } }, { projection: { title: 1, jurisdiction: 1 } })
      .toArray();
    const lawById = new Map(laws.map(l => [l._id.toHexString(), l]));

    const enriched = alerts.map(a => ({ ...a, law: lawById.get(a.lawId.toHexString()) ?? null }));

    return json(200, { alerts: enriched, page, pageSize: PAGE_SIZE });
  } catch (err) {
    console.error(JSON.stringify({ msg: 'alerts.fetch.failed', requestId, err: String(err) }));  // #3 + nit
    return json(500, { error: 'Internal error', requestId });
  }
};
```

Things to say while sketching it:

- **Order of the guards matters.** 401 (no identity) → 403 (identity, wrong customer) → 400 (malformed id) → 404 (well-formed, not found). Each one is a different question, and the status code tells the client which question failed.
- **Two queries instead of 600.** The `$in` on jurisdictions and the `$in` on law ids are the whole N+1 fix. An aggregation with `$lookup` would make it one query; say you would reach for that if the join gets more complex, and that two round trips is fine here.
- **The `$in` list is unbounded too.** `customer.jurisdictions` could be large. If they push, say you would cap it or move the join into a `$lookup` so Mongo does the fan-out server-side.
- **`skip` is fine to start.** It degrades at deep pages; the upgrade is a cursor on `(effectiveDate, _id)`. Name it, do not build it.
- **What you did not fix on purpose.** `MONGO_URI` still comes from an env var. Ask where it is populated from (Secrets Manager or Parameter Store) rather than rewriting config in a review.

---

## Part 2: Tech questions

Answer shape that scores well: **direct answer → why it works that way → a time you hit it in production.** The third clause is what separates you from a strong junior.

### AWS Lambda

- **Cold starts — what causes them, how do you reduce them?** New execution environment: download package, init runtime, run module-scope code. Reduce by shrinking the bundle, moving work out of the init path (or *into* it, for things you want reused), and provisioned concurrency for latency-sensitive paths. Note the tradeoff: provisioned concurrency costs money whether or not it's used.
- **Why declare the DB client outside the handler?** Module scope runs once per execution environment, so warm invocations reuse the connection pool. Inside the handler it runs every invocation.
- **How does Lambda scale, and what breaks downstream?** Concurrency scales out with load, so each concurrent environment holds its own pool — the failure mode is a fixed-size database getting hammered. Mitigations: reserved concurrency as a throttle, RDS Proxy for relational, conservative `maxPoolSize` for Atlas.
- **Memory vs CPU.** Coupled — more memory means proportionally more CPU. Over-provisioning memory sometimes *lowers* cost because the function finishes faster.
- **Retries and idempotency.** Async invocations retry twice by default; SQS triggers retry until the visibility timeout expires or the message hits the DLQ. So handlers must be idempotent — dedupe key, conditional write, or `upsert`.
- **Timeouts.** 15 min max for Lambda, but API Gateway caps at 29 seconds. Anything longer needs to be async with a status endpoint.

### MongoDB

- **Embed or reference?** Driven by read patterns and growth. Embed when the child is always read with the parent and bounded (a customer's jurisdiction list). Reference when it's unbounded, shared, or independently queried (law records shared across customers). Mention the 16 MB document limit as the hard ceiling.
- **Compound index prefix rule.** An index on `{ tenantId: 1, effectiveDate: -1 }` serves queries on `tenantId` alone and on both, but not `effectiveDate` alone. This is the single most useful index fact to have crisp.
- **How do you know a query is slow?** `explain('executionStats')` — looking for `IXSCAN` vs `COLLSCAN`, and `totalKeysExamined` / `totalDocsExamined` close to `nReturned`. A big gap means the index isn't selective.
- **Aggregation pipeline ordering.** `$match` and `$limit` as early as possible so later stages process fewer docs; `$match` before `$lookup`, not after.
- **Multi-tenant isolation.** Tenant ID as the first field of every compound index and a non-optional filter on every query. Worth saying out loud that you'd enforce it in a data-access layer rather than trusting each call site.
- **Transactions.** Available on replica sets, but the usual answer is that a good document model avoids needing them — keep data that changes together in one document.

### TypeScript

- **`unknown` vs `any`.** `unknown` forces a narrowing check before use; `any` disables checking and propagates silently. API responses should land as `unknown` and get validated (Zod or similar) at the boundary.
- **Discriminated unions.** A `type` or `status` literal field lets the compiler narrow in a `switch`, and with an exhaustiveness check (`const _: never = x`) adding a variant becomes a compile error instead of a runtime surprise. Have an example ready — this is the highest-signal TS answer.
- **Why is `as` a smell?** It asserts rather than proves; if the shape is wrong the error surfaces later and further away. Prefer type guards.
- **`interface` vs `type`.** Interfaces merge and are conventional for object contracts; type aliases handle unions, intersections, and mapped types. Mostly stylistic — don't over-invest.
- **Generics in practice.** Be ready to describe a real generic you wrote — a typed API client or repository wrapper — rather than defining generics abstractly.

### React

- **What triggers a re-render?** State change, prop change, parent re-render, context value change. Note that a new object or array identity counts as a change even when contents are equal — the source of most accidental re-render churn.
- **`useEffect` dependencies and stale closures.** The effect captures the values from its render; omitting a dep means the closure keeps stale values. Cleanup functions exist to cancel in-flight work and prevent out-of-order resolution.
- **When does memoization help?** When the child is genuinely expensive or the value feeds a dependency array. `useMemo` on a cheap computation adds cost and noise. Measure first.
- **Data fetching in effects vs a query library.** Effects mean hand-rolling caching, dedupe, retries, and race handling. React Query / SWR exist because everyone writes those bugs once.
- **Controlled vs uncontrolled, and form state.** Where does validation live, and how do server errors get surfaced back to fields.
- **`key` semantics.** Keys tell React which element is which across renders; index keys corrupt state when the list reorders or filters.

### Likely cross-cutting question

**"Walk me through what happens when a user loads this page."** Browser → CDN → API Gateway → Lambda (cold or warm) → auth → Mongo query (indexed?) → response → React render. They're checking whether you hold the whole stack in your head. Practice saying this end-to-end in about 90 seconds.

---

## Part 3: Whiteboarding

Structure to run every time, out loud, in this order:

1. **Clarify** — who uses it, how many, read-heavy or write-heavy, latency tolerance, consistency requirements.
2. **Sketch the flow** — boxes and arrows first, no details.
3. **Data model** — collections, key fields, indexes.
4. **Failure modes** — what happens when each box is down or slow.
5. **Tradeoffs** — name the alternative you rejected and why.

State an assumption rather than waiting for permission: "I'll assume a few thousand customers and tens of thousands of alerts a year — tell me if that's off." It keeps you moving and it's scored positively.

### If whiteboarding means writing code

At a small shop it often does. Nine short functions with solutions are in `coding-warmups.md`: debounce, a debounced-value hook, groupBy, a fetch hook with abort, jurisdiction-prefix matching, dedupe, tree flatten, event-loop output, pagination. Work them on paper Monday.

### Scenario 0 (most likely, given last year and the JD): a React app

Last year's whiteboard was a React app. Fully worked in `frontend-whiteboard.md` with its own spine (state placement, data contract, loading/empty/error, accessibility, testing). Do that one first.

### Scenario 1 (most likely backend scenario, given their domain): law-change notification system

*"Employment laws change constantly across federal, state, and local jurisdictions. Design a system that detects a change and notifies every affected customer."*

**Clarifying questions:** Is change detection automated or is there a human research team entering these? How fast must notification be — minutes or next business day? Do customers configure notification preferences? Do we need proof of delivery for audit purposes?

**A reasonable answer:**

- **Ingestion:** a `law_changes` collection written either by an internal editorial tool or by scrapers. Either way, a change is an immutable event record — never an in-place edit — because compliance means you need to reconstruct what was true on a given date.
- **Jurisdiction matching:** the fan-out step. Customers have worksite locations; each location maps to a jurisdiction hierarchy (federal → state → county → city). A law change targets a jurisdiction node, and affected customers are those with a location at or under that node. Index on the location's jurisdiction path so the match is one indexed query, not a scan of every customer.
- **Fan-out:** publish a `LawChanged` event to SNS or EventBridge, then a queue (SQS) of per-customer notification jobs consumed by Lambda. Explain *why* you're not doing this in the request path: fan-out to thousands of customers can't live in a 29-second API Gateway window, and a queue gives you retries and backpressure for free.
- **Idempotency:** dedupe key of `(customerId, lawChangeId, channel)` with a unique index, so a redelivered SQS message doesn't email the same customer twice. Raise this unprompted — it's the detail that signals you've run queues in production.
- **Delivery tracking:** a `notifications` collection with status transitions (`queued → sent → delivered → failed`), fed by SES/webhook callbacks. DLQ for terminal failures with alerting on DLQ depth.
- **Read path:** customers see alerts in a React dashboard; query is `{ tenantId, acknowledged: false }` sorted by `effectiveDate`, so index `{ tenantId: 1, acknowledged: 1, effectiveDate: -1 }`.

**Failure modes to name:** email provider down (queue drains later, no data loss), a bad law-change record fanned out to everyone (need a kill switch and an audit trail of who published), jurisdiction mapping wrong (a customer misses a change they were legally required to act on — the highest-severity failure, so it deserves reconciliation jobs and monitoring).

**Tradeoff to state:** synchronous fan-out is simpler and you'd reject it because notification volume is spiky and per-customer failures shouldn't fail the batch.

### Scenario 2: compliance document storage and delivery

*"Customers need to download the correct labor law posters for each of their locations, and we need an audit trail of what they downloaded and when."*

Hit: documents in S3 with versioning, metadata in Mongo, pre-signed URLs with short expiry (never proxying bytes through Lambda), tenant-scoped key prefixes, an append-only `document_access` audit collection, and a CDN for the shared unversioned assets. The interesting question is versioning: a poster valid last year must remain retrievable, so documents are immutable versions with effective date ranges, not mutable records.

### Scenario 3: bulk import

*"A new enterprise customer sends a spreadsheet of 40,000 employee worksite locations. Design the import."*

Hit: pre-signed S3 upload from the browser (not a Lambda payload — 6 MB limit), S3 event triggers a Lambda that chunks the file onto a queue, workers process batches with `bulkWrite`, per-row validation errors collected into a downloadable report rather than failing the whole job, an import-status record the UI polls, and idempotency so a re-run doesn't duplicate locations. Mention the 15-minute Lambda ceiling as the reason for chunking, and Step Functions or Fargate as the alternative if a chunk can't fit.

---

## The weekend plan

Three days left as of Sunday. Prioritized so that if you run out of time, what's skipped matters least.

- **Sunday:** the React app whiteboard (`frontend-whiteboard.md`) on paper, twice. Snippets A and B cold, out loud, timer on; read the keys and note only what you missed. Returning-candidate answer out loud five times.
- **Monday:** Snippets C through G cold (`practice-snippets.md`). Then `coding-warmups.md` on paper, all nine, no peeking. Scenario 1 (notification system) once. Skim the tech questions; any answer over 45 seconds, rewrite shorter.
- **Monday evening, dress rehearsal (60 min, timer on, no notes):** 20 min reviewing Snippet G or whichever snippet you have not opened, out loud. 20 min answering ten tech questions picked at random from the banks, 45 seconds each. 20 min whiteboarding Scenario 2 or 3 on paper. Record it on your phone and listen back once. This single hour is worth more than another read-through.
- **Tuesday:** `basics-rapid-fire.md`, `frontend-fundamentals.md`, and `tooling-review.md` once through, self-check questions only. Say the Git answers out loud; they were asked last year. Fill the culture worksheet. Stop tech by evening.
- **Wednesday morning:** `cheat-sheet.md` only.

Two things to remember in the room: the 20-minute budget per section means they expect an unfinished, well-reasoned answer, and naming the thing you're weighing out loud ("I'm deciding whether to fan out synchronously or queue it") is worth more than arriving at the answer silently.
