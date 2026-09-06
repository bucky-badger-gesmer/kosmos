# Whiteboard Walkthrough — A Fully Worked Answer

This models the **shape** of a strong whiteboard response for the most-likely *backend* scenario (a law-change notification system; the React app in `frontend-whiteboard.md` is the likelier round overall, from `govdocs-tech-panel-prep.md` §3). Study the *structure and narration*, not the exact architecture — they're scoring how you think, not whether you match a reference solution.

The italic **[SAY]** lines are what you say out loud; the rest is what ends up on the board. Target ~15–18 minutes; they expect it unfinished but well-reasoned.

---

## The prompt

> *"Employment laws change constantly across federal, state, and local jurisdictions. Design a system that detects a change and notifies every affected customer."*

---

## Step 0 — Frame it before you draw (30 sec)

**[SAY]** *"Let me restate the goal to make sure I've got it: a law changes somewhere in the jurisdiction hierarchy, and we need to reliably notify every customer with a location that the change applies to. I'll spend a minute on clarifying questions, sketch the flow, then go deep on the data model, failure modes, and one or two tradeoffs. Stop me if you'd rather I go deeper on any one part."*

That sentence alone scores — it shows you have a plan and you're collaborative.

---

## Step 1 — Clarify (2 min)

Ask 3–4 sharp questions, then **state assumptions and move** — don't wait for permission on everything.

- **Who detects the change?** Is there an internal research/editorial team entering law changes, or automated scrapers? *(Assume: an internal editorial tool writes an authoritative change record. This matters — it makes the source trustworthy and lower-volume.)*
- **How fast must notification be?** Real-time (minutes) or next-business-day acceptable? *(Assume: minutes-to-hours is fine; this isn't a trading system. That lets me use async queues, not a synchronous hot path.)*
- **Volume?** *(Assume: thousands of customers, tens of thousands of locations, a handful of law changes per day but each can fan out to many customers.)*
- **Do customers configure preferences** (channels, quiet hours)? *(Assume: yes, email + in-app, per-customer.)*
- **Is proof of delivery required for audit?** *(Assume: yes — it's a compliance product, so "we told you on this date" must be provable.)*

**[SAY]** *"I'll assume a few thousand customers, tens of thousands of locations, law changes entered by an internal team, minutes-to-hours latency, and that we need an auditable delivery record. Tell me if any of those are off — they change the design."*

---

## Step 2 — Sketch the flow (3 min)

Boxes and arrows first, no detail. Draw left-to-right:

```
                                   ┌─────────────┐
 Editorial tool ──writes──►  law_changes (Mongo, append-only)
                                        │
                                        │ change-stream / event
                                        ▼
                                 ┌──────────────┐
                                 │  Matcher      │  find affected customers
                                 │  (Lambda)     │  by jurisdiction
                                 └──────┬───────┘
                                        │ publish LawChanged
                                        ▼
                              ┌──────────────────┐
                              │ EventBridge / SNS│
                              └────────┬─────────┘
                                       ▼
                              ┌──────────────────┐
                              │  SQS queue        │  one job per (customer, change)
                              └────────┬─────────┘
                                       ▼
                        ┌──────────────────────────┐
                        │ Notifier (Lambda workers) │──► SES (email)
                        │  idempotent, per-customer │──► in-app (notifications coll.)
                        └────────────┬──────────────┘
                                     │ status callbacks
                                     ▼
                             notifications (Mongo)  ◄── React dashboard reads
                                     │
                              DLQ (terminal failures) ──► alarm on depth
```

**[SAY]** *"The core decision I'm making up front: notification is NOT in the request path. A single law change can fan out to thousands of customers, and fan-out that size can't live inside an API Gateway request — it caps at 29 seconds. So I'm going event-driven with a queue between detection and delivery. The queue also gives me retries and backpressure for free. I'll come back to why I rejected the synchronous version."*

That's a tradeoff stated proactively — high value.

---

## Step 3 — Data model (4 min) — spend the most time here

Patrick and Ben are engineers; the data model is where they can tell whether you have run this in production. Spend the time here.

**`law_changes` — append-only event records**
```js
{
  _id,
  jurisdictionPath: 'US/MN/Hennepin',   // hierarchical node the change targets
  lawType: 'minWage',
  effectiveFrom: ISODate('2025-07-01'),
  effectiveTo: null,
  publishedAt: ISODate(),
  publishedBy: 'editor:jdoe',           // audit
  supersedes: <lawChangeId | null>,
}
```
**[SAY]** *"A law change is immutable — never an in-place edit. Compliance means I have to reconstruct what was legally true on any past date, so I version with effective-date ranges instead of mutating. This also gives me a natural audit trail of who published what."*

**`customers` / `locations`** — the fan-out target
```js
// locations
{ _id, tenantId, name, jurisdictionPath: 'US/MN/Hennepin/Minneapolis' }
```
**[SAY]** *"Each location stores its full jurisdiction path. A law change targets a node; affected locations are those whose path is at or under that node. If I store the path as a string, `US/MN/Hennepin` matches any location whose path starts with it — a prefix query I can index. That turns 'who is affected' into one indexed query instead of scanning every customer."*

**Index:** `{ jurisdictionPath: 1 }` on `locations`, and `{ tenantId: 1, jurisdictionPath: 1 }` for tenant-scoped reads.

**`notifications` — the delivery record + read model**
```js
{
  _id,
  tenantId,
  customerId,
  lawChangeId,
  channel: 'email',
  status: 'queued',                 // queued → sent → delivered → failed
  effectiveDate,                    // copied from the law change so the dashboard sorts without a join
  dedupeKey: 'cust123:change789:email',   // unique index
  acknowledged: false,
  createdAt, updatedAt,
}
```
**Indexes:**
- Unique on `dedupeKey` — idempotency (a redelivered SQS message can't double-send).
- `{ tenantId: 1, acknowledged: 1, effectiveDate: -1 }` — the dashboard read (ESR: equality, equality, sort).

**[SAY]** *"The `notifications` collection does double duty — it's the audit record of what we sent and when, and it's the read model the customer dashboard queries. The unique dedupe key is what makes redelivery safe."*

---

## Step 4 — Walk one change through the system (2 min)

**[SAY]** *"Let me trace one law change end to end:"*

1. Editor publishes → insert into `law_changes`.
2. A **change stream** (or the editorial tool emits an event) triggers the **Matcher** Lambda.
3. Matcher runs the prefix query on `locations` → distinct `tenantId`s affected → cross-references each customer's notification preferences.
4. Matcher publishes a `LawChanged` event; a fan-out writes **one SQS message per (customer, channel)**.
5. **Notifier** workers consume the queue: check the dedupe key, send via SES / write an in-app notification, update `status`.
6. SES delivery/bounce callbacks update `status` → `delivered` / `failed`.
7. Customer opens the React dashboard → query `{ tenantId, acknowledged: false }` sorted by effective date.

---

## Step 5 — Failure modes (3 min) — name them proactively

| What fails | What happens / mitigation |
|---|---|
| **Email provider (SES) down** | Messages stay on the queue; workers retry with backoff; drains when SES recovers. **No data loss** — that's the point of the queue. |
| **A bad law-change record fanned out to everyone** | Highest-blast-radius failure. Need a **kill switch** (halt the Notifier), the append-only audit trail to see who published it, and a `supersedes` correction record. |
| **Jurisdiction mapping is wrong** | The *worst* failure — a customer misses a change they were legally required to act on. Deserves **reconciliation jobs** (periodically recompute affected sets and diff against what was sent) and monitoring. Call this out as the highest-severity risk. |
| **Duplicate SQS delivery** | Unique dedupe key → the second insert fails harmlessly. No double email. |
| **A single customer's send throws** | Isolated to that message; retries, then to **DLQ** after N attempts. **Alarm on DLQ depth.** One bad address never blocks the batch. |
| **Poison message loops** | Max receive count → DLQ, so it can't retry forever. |

**[SAY]** *"In a compliance product the ranking of failures is unusual: a missed notification is far worse than a duplicate one. So I bias every decision toward 'at-least-once delivery plus dedupe' rather than 'exactly-once,' which is much harder and not worth it here."*

That sentence — reasoning about *which* failure is worse in *this domain* — is the single highest-signal thing you can say.

---

## Step 6 — Tradeoffs you rejected (1–2 min)

**[SAY]** *"Three things I decided against and why:"*

- **Synchronous fan-out in the API request** — simplest, but notification volume is spiky, per-customer failures shouldn't fail the batch, and it can't fit the 29-second gateway window. Rejected.
- **Exactly-once delivery** — expensive and fragile; at-least-once + a dedupe key gets the same user-visible result. Rejected.
- **Denormalizing "affected customers" onto each law change at write time** — would make reads instant, but customer locations change, so the set goes stale. I compute affected customers at fan-out time instead. *(This is a genuine embed-vs-reference tradeoff — flag that you considered it.)*

---

## Step 7 — "If we had more time" (30 sec)

**[SAY]** *"With more time I'd flesh out: notification preferences and quiet hours, rate-limiting against SES send quotas, batching per-customer digests instead of one email per change, and the observability — structured logs with a correlation id per change, a Datadog monitor on DLQ depth and end-to-end latency."*

Naming what you'd do next shows scope awareness and ties back to the Datadog/observability theme in the JD.

---

## The scoring rubric they're (probably) using

Map your performance to what interviewers actually grade:

- ✅ **Did you clarify before designing?** (Step 1)
- ✅ **Did you state assumptions and keep moving** rather than stalling? (Step 1 close)
- ✅ **Is the data model sound** — indexes, embed-vs-reference reasoning, the immutability insight? (Step 3)
- ✅ **Did you reason about failure**, and rank failures *by this domain*? (Step 5)
- ✅ **Did you name tradeoffs and the alternative you rejected?** (Step 2, Step 6)
- ✅ **Did you narrate your thinking out loud** the whole way?

Missing the "perfect" architecture costs little. Silence, no clarifying questions, and no failure-mode thinking cost a lot.

---

## Now do it yourself

Cover this file. Set 15 minutes. Whiteboard **Scenario 2 (compliance document storage + audit trail)** or **Scenario 3 (40k-location bulk import)** from the prep doc using this exact seven-step spine:

**Clarify → Sketch → Data model → Trace one request → Failure modes → Tradeoffs rejected → If we had more time.**

Do it twice. The second pass will be dramatically better — that improvement *is* the prep.
