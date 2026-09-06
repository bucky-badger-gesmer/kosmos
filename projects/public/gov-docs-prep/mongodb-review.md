# MongoDB Review

MongoDB is named in the JD and Snippet B is Mongo-heavy, so expect the tech panel (Patrick and Ben, 2:00) to probe it. Nick Running manages Data Engineering but sits on the 3:00 culture panel; a data-modeling insight dropped naturally into a story will land with him, but he is not there to quiz you. The compliance domain is a natural fit for questions on modeling variance-over-jurisdiction and change-over-time.

---

## "Why Mongo instead of Postgres?" (they will ask; you just built a SQL API)

Have a balanced answer, not a fan answer. Both are fine databases; the choice is about the shape of the data and the team.

- **Mongo fits when** documents are naturally nested and read whole (a location with its address and posting list), the schema varies across records (1,500 posting types with different attributes), you want to iterate the schema quickly, and horizontal scale matters more than joins.
- **Relational fits when** data is highly normalized and joined many ways, you need multi-row transactions constantly, or reporting and ad-hoc SQL are first-class needs.
- **The honest tradeoff.** Mongo pushes joins and integrity to the application. Discipline that Postgres enforces with foreign keys and constraints has to live in your data-access layer, validation, and indexes. Say that out loud; it shows you have felt the cost.
- **Your bridge.** "I just built an Express API on SQLite with prepared statements and a deliberate no-ORM decision. The modeling questions are the same, where does this data live and how is it read, the answers just differ. In Mongo I'd embed what's read together and reference what's shared or unbounded."
- **Don't say** "Mongo is schemaless." Say "schema-flexible, and the schema lives in your types and validators (Zod, or Mongo's own JSON Schema validation) instead of the database."

---

## Data modeling: embed vs reference

Driven by **read patterns** and **growth**, not by taste.

**Embed when** the child is always read with the parent and is bounded:
- A customer's list of jurisdictions.
- A location's address.

**Reference when** the child is unbounded, shared, or independently queried:
- Law records shared across many customers.
- A location's notification history (grows without limit).

**Hard ceiling:** 16 MB per document. An unbounded array is a modeling bug waiting to happen — say this out loud.

**Compliance-specific pattern — immutability over time.** A law change is an *event record*, never an in-place edit. To reconstruct "what was legally true on date X," you keep versioned documents with effective date ranges (`effectiveFrom` / `effectiveTo`), not a single mutable row. This is the modeling insight that lands best in their domain.

```js
// Bad: mutable, loses history
{ _id, jurisdiction: 'MN', minWage: 11.13 }

// Good: append-only versions
{ _id, jurisdiction: 'MN', minWage: 11.13, effectiveFrom: ISODate('2025-01-01'), effectiveTo: null }
```

---

## Indexing — the highest-yield topic

**Compound index prefix rule.** An index on `{ tenantId: 1, effectiveDate: -1 }` serves:
- queries on `tenantId` alone ✅
- queries on `tenantId` + `effectiveDate` ✅
- queries on `effectiveDate` alone ❌ (can't skip the prefix)

This is the single most useful index fact to have instant.

**ESR rule** for ordering compound index fields: **E**quality → **S**ort → **R**ange.
- Fields matched by equality first.
- Then the field(s) you sort on.
- Then range filters (`$gt`, `$lt`, `$in` over a span) last.

```js
// Query: find by tenant (eq), filter unacknowledged (eq), sort by date (sort)
db.alerts.find({ tenantId, acknowledged: false }).sort({ effectiveDate: -1 })
// Index (ESR): { tenantId: 1, acknowledged: 1, effectiveDate: -1 }
```

**Index types worth naming:**
- Single-field, compound.
- **Multikey** — automatic when a field is an array (e.g. `jurisdictions: [...]`). One caveat: can't have a compound index with two array fields.
- **Text** — full-text search on string fields.
- **TTL** — auto-expire documents after N seconds (sessions, ephemeral notifications).
- **Partial / sparse** — index only documents matching a filter (e.g. only `acknowledged: false`), smaller and faster.
- **Unique** — enforces uniqueness; the mechanism behind an idempotency dedupe key.

**Covered query.** If a query and its projection are fully served by the index, Mongo never touches the documents (`totalDocsExamined: 0`). Fast. Achieved by including the projected fields in the index.

---

## Diagnosing slow queries

`explain('executionStats')` is the answer to "how do you know a query is slow?"

Look for:
- **`IXSCAN` vs `COLLSCAN`** — a collection scan on a large collection is the red flag.
- **`totalKeysExamined` / `totalDocsExamined` vs `nReturned`** — a big gap means the index isn't selective (examining 100k docs to return 10).
- **`totalDocsExamined: 0`** with results returned → covered query, ideal.

```js
db.alerts.find({ tenantId, acknowledged: false })
         .sort({ effectiveDate: -1 })
         .explain('executionStats');
```

---

## Aggregation pipeline

Stages run in order; each feeds the next. Ordering matters for performance.

**Rule: filter and shrink early.** `$match` and `$limit` as early as possible so later stages process fewer documents. `$match` before `$lookup`, never after.

Key stages:
- **`$match`** — filter (uses indexes when it's the first stage).
- **`$project`** — reshape / drop fields.
- **`$group`** — aggregate (`$sum`, `$avg`, `$push`).
- **`$sort`** — order (uses index if early; otherwise in-memory, 100 MB limit unless `allowDiskUse`).
- **`$lookup`** — left outer join to another collection. The fix for the Snippet B `laws` N+1.
- **`$unwind`** — flatten an array into one doc per element.
- **`$facet`** — multiple sub-pipelines in one pass (e.g. results + total count for pagination).

```js
// Replace the Snippet B N+1 (loop + per-alert law lookup) with one pipeline:
db.alerts.aggregate([
  { $match: { jurisdiction: { $in: customer.jurisdictions } } },
  { $lookup: { from: 'laws', localField: 'lawId', foreignField: '_id', as: 'law' } },
  { $unwind: '$law' },
  { $sort: { effectiveDate: -1 } },
  { $limit: 100 },
]);
```

---

## The N+1 problem (Snippet B's headline)

A loop of one-query-per-item is N+1. Fixes:
- **`$in`** — batch a set of ids/values into one query.
- **`$lookup`** — join in the aggregation pipeline.

Be able to *rewrite the loop live*. A customer in 30 jurisdictions with 20 alerts each is 600+ round trips as written vs 1–2 batched.

---

## Query & write essentials

- **`_id` type mismatch** — if `_id` is an `ObjectId`, matching a raw string returns `null` forever (looks like "no data," not an error). Cast with `new ObjectId(str)` (throws on malformed input — wrap it) or confirm ids are stored as strings.
- **Projection** — always project only needed fields; reduces payload and enables covered queries.
- **Pagination** — prefer **cursor/range-based** (`_id > lastId` or `effectiveDate < last`) over `skip()`, which gets slower as the offset grows (it still walks skipped docs).
- **`bulkWrite`** — batch inserts/updates for imports; far fewer round trips (relevant to the 40k-location import scenario).
- **`updateOne` with `upsert: true`** — insert-or-update; the idempotency primitive.

---

## Multi-tenant isolation (compliance = this matters a lot)

- **Tenant id is the first field of every compound index** and a **non-optional filter on every query.**
- Enforce it in a **data-access layer**, not by trusting each call site.
- Tenant id comes from the **verified auth context**, never from user input (this is the Snippet B IDOR finding).

---

## Consistency & operations (awareness-level)

- **Replica set** — primary + secondaries; automatic failover.
- **Write concern** — `w: 'majority'` waits for a majority to acknowledge (durability vs latency tradeoff).
- **Read preference** — `primary` (default, consistent) vs `secondary` (scale reads, may be stale).
- **Transactions** — available on replica sets, but the standard answer is *a good document model avoids needing them*: keep data that changes together in one document. Mention this rather than reaching for transactions first.
- **Atlas** — managed Mongo; connection limits per tier is why Lambda connection reuse (see `lambda-aws-review.md`) matters.

---

## Quick self-check questions

1. State the compound-index prefix rule with an example.
2. Order the fields for a query that filters on `tenantId` + `status` and sorts by date. (ESR)
3. How do you prove a query uses an index? (`explain`, `IXSCAN`, keys≈returned)
4. Rewrite an N+1 loop with `$in` or `$lookup`.
5. Embed or reference for: a customer's locations? law records? notification history?
6. Why does `find({ _id: "abc123" })` return nothing when data clearly exists? (ObjectId vs string)
7. Why prefer range pagination over `skip`?
8. How do you enforce tenant isolation at scale?
