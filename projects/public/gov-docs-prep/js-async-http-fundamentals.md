# JavaScript Async + HTTP/REST Fundamentals

This is the "basic technical questions" bucket you remember from last year. These are quick, and getting them crisp buys easy early confidence in the room.

---

## The event loop

JavaScript is **single-threaded** with a **non-blocking** async model.

- **Call stack** — synchronous code runs here, one frame at a time.
- **Web APIs / host** — timers, fetch, I/O run outside the engine.
- **Microtask queue** — resolved Promise callbacks (`.then`, `await` continuations), `queueMicrotask`. Drained **fully** after each stack frame empties, **before** the next macrotask.
- **Macrotask queue** — `setTimeout`, `setInterval`, I/O callbacks, UI events. One per loop turn.

**Order rule:** all microtasks drain before the next macrotask.

```js
console.log('A');
setTimeout(() => console.log('B'), 0);   // macrotask
Promise.resolve().then(() => console.log('C'));  // microtask
console.log('D');
// Output: A, D, C, B
```

Being able to explain this output cleanly is a classic screener.

---

## Promises

A Promise is a placeholder for a future value: **pending → fulfilled | rejected**. Settled once, immutably.

- **`.then(onFulfilled, onRejected)`**, **`.catch`**, **`.finally`**.
- Chaining flattens returned promises; a throw inside `.then` rejects the chain.

**Combinators — know all four:**
- **`Promise.all`** — waits for all; **rejects fast** on the first rejection (loses the others' results). Use when you need every result and any failure is fatal.
- **`Promise.allSettled`** — waits for all; never rejects; returns `{status, value|reason}[]`. Use for **partial-failure fan-out** (notify 1000 customers, tolerate some failures).
- **`Promise.race`** — settles as soon as the first settles (fulfill or reject). Timeouts.
- **`Promise.any`** — first *fulfilled*; rejects only if all reject (`AggregateError`).

---

## async/await

`await` pauses the async function and yields to the event loop; the continuation is a microtask. Errors surface as normal throws — use `try/catch`.

**The sequential-vs-parallel bug** (this is exactly Snippet B):

```ts
// ❌ Sequential — each awaits the previous. Slow. This is the N+1 loop.
for (const j of jurisdictions) {
  const found = await db.collection('alerts').find({ jurisdiction: j }).toArray();
}

// ✅ Parallel — fire together, await together
const results = await Promise.all(
  jurisdictions.map(j => db.collection('alerts').find({ jurisdiction: j }).toArray())
);

// ✅✅ Better still — one batched query (no fan-out at all)
const results = await db.collection('alerts')
  .find({ jurisdiction: { $in: jurisdictions } }).toArray();
```

Be ready to explain: the *loop* in Snippet B is sequential (slow), the `enriched` map uses `Promise.all` (parallel) — and the *real* fix is neither, it's a single `$in`/`$lookup`. Knowing which is which reads as senior.

**Common async gotchas:**
- `forEach` does **not** await — its callback promises are ignored. Use `for...of` (sequential) or `map` + `Promise.all` (parallel).
- Unhandled rejection — a rejected promise with no `.catch` (Snippet A's fetch chain). Always terminate a chain.
- `await` in a loop is sometimes correct (rate-limiting, ordered dependency) — say *why* you chose it.

---

## Closures, `this`, and other JS staples

- **Closure** — a function retains access to its lexical scope after the outer function returns. Powers hooks, memoization, and the stale-closure bug in `useEffect`.
- **`this`** — determined by call site for regular functions; **arrow functions capture `this` lexically** (why arrows are used for callbacks/handlers).
- **`==` vs `===`** — always `===` (no coercion).
- **`let`/`const` vs `var`** — block scope vs function scope + hoisting. Use `const` by default.
- **Spread/rest, destructuring, optional chaining `?.`, nullish coalescing `??`** — know the difference between `??` (null/undefined only) and `||` (any falsy).
- **Shallow vs deep copy** — `{...obj}` copies one level; nested objects share references (root cause of accidental state mutation).

---

## HTTP / REST

**Methods & idempotency:**
| Method | Purpose | Idempotent? | Safe? |
|---|---|---|---|
| GET | read | yes | yes |
| POST | create | no | no |
| PUT | replace | yes | no |
| PATCH | partial update | not necessarily | no |
| DELETE | remove | yes | no |

Idempotent = same result if repeated. Matters for **retries** — a retried PUT/DELETE is safe; a retried POST can double-create (hence idempotency keys, see `lambda-aws-review.md`).

**Status codes to know cold:**
- **2xx** — 200 OK, 201 Created, 204 No Content.
- **3xx** — 301/302 redirect, 304 Not Modified (caching).
- **4xx (client)** — 400 bad request, 401 unauthenticated, 403 authenticated-but-forbidden, 404 not found, 409 conflict, 422 unprocessable, 429 rate-limited.
- **5xx (server)** — 500 internal, 502 bad gateway, 503 unavailable, 504 gateway timeout.

Know **401 vs 403** (who you are vs what you're allowed) and **400 vs 404 vs 500** (missing customer → 404, not 500 — a Snippet B point).

**REST design principles:**
- Resource-oriented URLs (nouns): `/customers/{id}/alerts`, not `/getAlerts`.
- Statelessness — each request carries its own auth/context.
- **Auth in the `Authorization` header**, never in the query string (Snippet A finding — query strings land in logs/history/proxies).
- Pagination, filtering, sorting via query params.
- Meaningful status codes + a consistent error body shape.

**Other essentials:**
- **CORS** — browser same-origin policy; the server opts in via `Access-Control-Allow-*` headers; preflight `OPTIONS` for non-simple requests. A very common front-end debugging question.
- **Caching** — `Cache-Control`, `ETag` + `If-None-Match` → 304.
- **Auth schemes** — Bearer tokens / JWT (stateless, self-contained claims) vs session cookies (httpOnly, server-side). JWTs can't be easily revoked before expiry — a known tradeoff.
- **httpOnly cookies vs localStorage** for tokens — localStorage is XSS-readable (Snippet A); httpOnly cookies aren't reachable from JS but need CSRF protection.

---

## Quick self-check questions

1. Predict the output of `console.log` + `setTimeout(0)` + `Promise.then`. Explain microtask vs macrotask.
2. `Promise.all` vs `allSettled` — which for fanning out notifications, and why?
3. Why doesn't `array.forEach(async ...)` await?
4. Which HTTP methods are idempotent, and why does it matter for retries?
5. 401 vs 403? 400 vs 404?
6. Why put an auth token in a header, not a query string?
7. What is CORS and when does a preflight happen?
8. Arrow function vs regular function — how does `this` differ?
