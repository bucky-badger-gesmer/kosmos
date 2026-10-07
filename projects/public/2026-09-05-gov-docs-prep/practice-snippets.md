# Fresh Code-Review Practice Snippets

New material, not spoiled by the answer keys in `govdocs-tech-panel-prep.md`. Five snippets covering the areas most likely to appear: async/Promise, MongoDB aggregation, a Mantine form, a React data-table, and a Playwright test. The test is there because the JD names Playwright and "well-tested code" next to "contribute to code reviews", so a test file is a plausible thing to be handed.

## How to use this

1. **Code first, keys last.** All five snippets are below. All five answer keys are at the very bottom. Don't scroll to the key until you've worked the snippet.
2. **10-minute timer per snippet.** Talk out loud.
3. **Say findings in order:** correctness → security → error handling → performance → readability. Label each **blocking** or **nit**.
4. **Open with a question about intent**, not a criticism. ("What's the expected behavior when a jurisdiction has no alerts?")
5. Then read the key and note **only what you missed** — that list is your real study material.
6. **Snippet G is a test file.** Review it the same way. The order shifts slightly: does it test the right thing → will it be flaky → is it isolated → is it readable.

---

# The snippets

## Snippet C — Async / Promise (Lambda notification fan-out)

```ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

type Customer = { id: string; email: string };

export async function notifyCustomers(customers: Customer[], lawChangeId: string) {
  const sent: string[] = [];

  customers.forEach(async (customer) => {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: `Law change ${lawChangeId}` },
        Body: { Text: { Data: `A law affecting you has changed.` } },
      },
      Source: 'alerts@govdocs.com',
    });
    await ses.send(command);
    sent.push(customer.id);
  });

  console.log(`Sent ${sent.length} of ${customers.length} notifications`);
  return { notified: sent };
}
```

---

## Snippet D — MongoDB aggregation (customer compliance dashboard)

```ts
// Returns, per jurisdiction, how many unacknowledged alerts a customer has.
export async function alertSummary(db: Db, tenantId: string) {
  const summary = await db.collection('alerts').aggregate([
    {
      $lookup: {
        from: 'laws',
        localField: 'lawId',
        foreignField: '_id',
        as: 'law',
      },
    },
    { $unwind: '$law' },
    { $match: { tenantId: tenantId, acknowledged: false } },
    {
      $group: {
        _id: '$jurisdiction',
        count: { $sum: 1 },
        alerts: { $push: '$$ROOT' },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  return summary;
}
```

---

## Snippet E — Mantine form (acknowledge with a note)

```tsx
import { useForm } from '@mantine/form';
import { TextInput, Textarea, Button } from '@mantine/core';

type AckValues = { note: string; acknowledgedBy: string };

export function AcknowledgeForm({ alertId }: { alertId: string }) {
  const form = useForm<AckValues>({
    initialValues: { note: '', acknowledgedBy: '' },
    validate: {
      acknowledgedBy: (value) => (value ? null : 'Required'),
    },
  });

  const handleSubmit = (values: AckValues) => {
    fetch(`/api/alerts/${alertId}/ack`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    form.reset();
    alert('Acknowledged!');
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput label="Your name" {...form.getInputProps('acknowledgedBy')} />
      <Textarea label="Note" {...form.getInputProps('note')} />
      <Button type="submit">Acknowledge</Button>
    </form>
  );
}
```

---

## Snippet F — React data-table (paginated locations)

```tsx
import React, { useState, useEffect } from 'react';

type Location = { id: string; name: string; jurisdiction: string; postingCount: number };

export function LocationsTable({ customerId }: { customerId: string }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/customers/${customerId}/locations?page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        setLocations([...locations, ...data.locations]);
        setTotal(data.total);
      });
  }, [page]);

  const totalPostings = locations.reduce((sum, l) => sum + l.postingCount, 0);

  return (
    <div>
      <p>Total postings across all locations: {totalPostings}</p>
      <table>
        <tbody>
          {locations.map((loc) => (
            <tr key={loc.id}>
              <td>{loc.name}</td>
              <td>{loc.jurisdiction}</td>
              <td>{loc.postingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setPage(page + 1)}>Load more</button>
    </div>
  );
}
```

---

## Snippet G — Playwright test (alert acknowledge flow)

```ts
import { test, expect } from '@playwright/test';

let alertId: string;

test('creates an alert', async ({ page }) => {
  await page.goto('http://localhost:3000/alerts');
  await page.click('.btn-primary');
  await page.fill('#note', 'Poster replaced');
  await page.click('button:nth-child(3)');
  await page.waitForTimeout(3000);
  alertId = await page.locator('.alert-row').first().getAttribute('data-id');
  expect(await page.locator('.alert-row').count()).toBeGreaterThan(0);
});

test('acknowledges the alert', async ({ page }) => {
  await page.goto(`http://localhost:3000/alerts/${alertId}`);
  await page.click('text=Acknowledge');
  await page.waitForTimeout(1000);
  expect(page.locator('.status')).toHaveText('Acknowledged');
});
```

---
---

# ANSWER KEYS

*(Stop here until you've worked all five.)*

---

## Snippet C key — Async / Promise

**Blocking:**

1. **`forEach` with an `async` callback does not await.** This is the headline bug. `forEach` ignores the returned promises, so the function does **not** wait for any email to send. `sent` is still empty when `console.log` and `return` run — the log always says "Sent 0 of N," and if this is a Lambda, the environment may be frozen/torn down before the in-flight `ses.send` calls finish. Fix with `for...of` (sequential) or `Promise.all(customers.map(...))` (parallel).
2. **No error handling / no partial-failure isolation.** One `ses.send` rejection with `Promise.all` would reject the whole batch and lose which succeeded. For fan-out you almost always want **`Promise.allSettled`** so one bad address doesn't stop the rest, then report failures. This is the key "I've run queues/fan-out in production" signal.
3. **No idempotency.** If this runs from an async event source (SNS/SQS retries), a redelivery re-emails everyone. Needs a dedupe key like `(customerId, lawChangeId)` with a unique-index guard before sending.

**The fixed shape:**
```ts
const results = await Promise.allSettled(
  customers.map(async (customer) => {
    await ses.send(new SendEmailCommand({ /* ... */ }));
    return customer.id;
  })
);
const sent = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value);
const failed = results.filter(r => r.status === 'rejected');
if (failed.length) console.error({ msg: 'notify.partial_failure', failed: failed.length });
return { notified: sent, failed: failed.length };
```

**Nits:**
- No batching/rate limiting — SES has a send rate; a huge `Promise.all` could hit throttling. Mention chunking.
- `sent.push` from concurrent callbacks is fine in single-threaded JS, but building the array from `allSettled` results is cleaner.
- Email body is a static string ignoring `lawChangeId` details — probably a stub, worth asking.

**Trap:** the fix is *not* just wrapping in `Promise.all` — that reintroduces the all-or-nothing failure problem. Reaching for `allSettled` is what reads as senior.

---

## Snippet D key — MongoDB aggregation

**Blocking:**

1. **`$match` is in the wrong position — after `$lookup` and `$unwind`.** This is the headline performance bug. As written, Mongo joins the `laws` collection onto **every alert across every tenant**, unwinds them all, and only *then* filters to one tenant's unacknowledged alerts. The `$match` must come **first** so it can use an index and so later stages process a fraction of the data. **Filter early.**
2. **The `$match` can't use an index where it sits.** Only a `$match` at the **start** of the pipeline uses collection indexes. Moved to the front, it should hit a compound index `{ tenantId: 1, acknowledged: 1 }`.
3. **`$push: '$$ROOT'` is unbounded and probably unnecessary.** Pushing every full alert document into each group can blow the 16 MB per-document aggregation limit for a large customer, and the function's stated purpose is just *counts per jurisdiction* — it doesn't need the full docs. Drop it (or push a projected subset with a limit).

**The fixed shape:**
```ts
db.collection('alerts').aggregate([
  { $match: { tenantId, acknowledged: false } },          // first — uses the index
  { $group: { _id: '$jurisdiction', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
// The $lookup/$unwind were never needed for a count — drop them entirely.
```

**Nits / follow-ups:**
- The whole `$lookup`/`$unwind` on `laws` is dead work for a count summary — ask what it was for; if law names are needed, look them up only on the grouped result.
- `$unwind` without `preserveNullAndEmptyArrays` silently drops alerts whose `lawId` has no matching law — a correctness footgun that could undercount.
- No `allowDiskUse` consideration, but with an early `$match` the working set is small, so it's fine.
- Confirm the index `{ tenantId: 1, acknowledged: 1 }` actually exists.

**Trap:** the `$lookup` isn't inherently wrong — it's wrong *here* because (a) it runs before the filter and (b) the output doesn't use it. Knowing it's "misplaced and unused" rather than "joins are bad" is the senior read.

---

## Snippet E key — Mantine form

**Blocking:**

1. **`fetch` is fire-and-forget — not awaited, no error handling.** The submit shows "Acknowledged!" and resets the form **regardless of whether the request succeeded.** A 500 or network failure silently lies to the user. Make the handler `async`, `await` the fetch, check `res.ok`, and only reset + confirm on success; surface an error otherwise (`form.setErrors` or a notification).
2. **No `res.ok` check.** Same class as Snippet A — a failed request never throws on its own here, so the failure is invisible.
3. **Missing `Content-Type: application/json` header.** `JSON.stringify(values)` is sent, but without `headers: { 'Content-Type': 'application/json' }` the server may not parse the body as JSON. Common real bug.
4. **No submit-in-flight state.** Double-clicking "Acknowledge" fires duplicate POSTs. The button should be `disabled`/`loading` while the request is in flight (`useState` for loading, or Mantine's `Button loading` prop).

**The fixed shape:**
```tsx
const [loading, setLoading] = useState(false);

const handleSubmit = async (values: AckValues) => {
  setLoading(true);
  try {
    const res = await fetch(`/api/alerts/${alertId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    form.reset();
    notifications.show({ message: 'Acknowledged' });
  } catch (err) {
    notifications.show({ color: 'red', message: 'Could not acknowledge — try again' });
  } finally {
    setLoading(false);
  }
};
// <Button type="submit" loading={loading}>Acknowledge</Button>
```

**Nits:**
- Native `alert()` for confirmation is jarring and untestable — use Mantine `notifications`.
- `acknowledgedBy` as a free-text "your name" field is a weak audit trail — in a compliance product, who acknowledged should come from the authenticated user, not typed input. Worth raising as a domain concern.
- No validation on `note` length; probably fine.
- Consider disabling the button until `form.isValid()` for clearer UX (optional).

**Trap:** Mantine's `useForm` + `getInputProps` wiring here is actually **correct** — the validation setup is fine. The bugs are all in the submit handler, not the form binding. Don't invent a Mantine problem that isn't there.

---

## Snippet F key — React data-table

**Blocking:**

1. **Stale closure over `locations` in the effect.** `setLocations([...locations, ...data.locations])` reads `locations` from the render the effect closed over. Combined with the deps array being only `[page]`, this is fragile: use the functional updater `setLocations(prev => [...prev, ...data.locations])`. (With `locations` correctly in the deps it would loop infinitely instead — so the functional updater is the right fix, not adding the dep.)
2. **`totalPostings` is misleading / wrong-by-design.** It sums `postingCount` over only the **currently loaded** locations, but the label says "across all locations." After loading 2 of 10 pages it shows a partial total presented as complete. The total must come from the server (an aggregate), not a client-side reduce over a partial list.
3. **No error handling and no `res.ok` check** — same family as the other snippets; a failed page load silently does nothing and "Load more" appears broken.
4. **No loading / end-of-data guard.** "Load more" is always clickable even when all rows are loaded (`locations.length >= total`) or while a request is in flight — double-clicks fire overlapping requests that append duplicates. Disable when loading or when `locations.length >= total`.

**Nits:**
- No `AbortController` cleanup — rapid clicks can resolve out of order and interleave pages. Lower risk with append-only, but worth a mention.
- `page` starting at 0 while the button does `page + 1` — confirm the API is 0-indexed; off-by-one page bugs are common.
- No table header (`<thead>`) — accessibility/readability nit.
- Appending pages into one growing list means `key={loc.id}` is correct **only if ids are unique across pages** — a server that returns overlapping pages would create duplicate keys. Fine if pagination is stable.
- If this list can grow large (thousands of locations), mention virtualization as a "when it grows" note, not a finding.

**Trap:** `key={loc.id}` is **correct** here (stable domain id) — don't flag it. The real state bug is the stale-closure append and the partial-total math, not the key.

---

---

## Snippet G key — Playwright test

**Blocking:**

1. **Tests share mutable state.** `alertId` is a module-level variable written by test one and read by test two. Playwright runs test files in parallel workers and can run tests within a file in any order (`fullyParallel`), so test two reads `undefined` and navigates to `/alerts/undefined`. Each test must set up its own data, or the two steps belong in one test. This is the headline finding.
2. **Hard-coded waits.** `waitForTimeout(3000)` and `waitForTimeout(1000)` are the source of flaky-and-slow. Playwright auto-waits on actions and web-first assertions retry until they pass. Delete the sleeps and assert on the state you are waiting for.
3. **Missing `await` on a web-first assertion.** `expect(locator).toHaveText(...)` returns a promise. Without `await`, the test finishes before the check runs, and the failure surfaces later as an unhandled rejection or not at all. A test that cannot fail is worse than no test.
4. **Brittle selectors.** `.btn-primary`, `#note`, `button:nth-child(3)`, `.alert-row`, `.status` all break on a restyle or a reorder and say nothing about what the user sees. Use `getByRole('button', { name: /acknowledge/i })`, `getByLabel(/note/i)`, `getByRole('row')`. Role locators double as an accessibility check.
5. **`text=Acknowledge` is a substring match.** The unquoted `text=` selector is case-insensitive and matches substrings, so it also matches the "Acknowledged" status text, and the click either hits the wrong element or fails on a strict-mode violation once both are present. Use `getByRole('button', { name: 'Acknowledge', exact: true })`.

**The fixed shape:**

```ts
test('acknowledges an alert', async ({ page }) => {
  await page.route('**/api/alerts*', route => route.fulfill({ json: { items: [fixtureAlert] } }));
  await page.goto('/alerts');                                         // baseURL from config
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await page.getByLabel(/note/i).fill('Poster replaced');
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByRole('status')).toHaveText(/acknowledged/i); // retries, awaited
});
```

**Nits:**

- Hard-coded `http://localhost:3000` instead of `baseURL` in `playwright.config`. Breaks in CI and against staging.
- `getAttribute` returns `string | null`; assigning it to `let alertId: string` does not compile under `strict`. Small, but it shows you read the types.
- `expect(await locator.count()).toBeGreaterThan(0)` is a one-shot assertion. `await expect(locator).not.toHaveCount(0)` retries.
- No network stubbing, so the test depends on whatever is in the backend's database that day. `page.route` makes it deterministic. Say when you would *not* stub: the one or two true end-to-end journeys.
- The legacy `page.click(selector)` and `page.fill(selector)` API still works, but locators are the current idiom.
- Test titles describe steps, not behavior. "acknowledging an alert updates its status" tells the reader what broke.

**Trap:** `waitForTimeout` is not a sin in every context. It is fine while debugging locally. The finding is that it is committed as the synchronization mechanism. Likewise, `expect(...).toHaveText` is the *right* assertion; the bug is the missing `await`, not the matcher.

# After you've done all five

You now have **seven** snippets total across this file and the prep doc. Common threads to notice — these are the patterns they're really testing:

- **Every snippet has a missing `res.ok` / error-handling gap.** It's the most reliable finding; always check it.
- **Filter/shrink early** (Mongo `$match` placement, batched queries) recurs.
- **Async correctness** (`forEach` doesn't await, stale closures, sequential-vs-parallel) recurs.
- **Say what's *right*** — each snippet has a deliberate not-a-bug (Mantine binding, the `key`, the `$lookup` mechanics, the `toHaveText` matcher).
- **Tests are code.** Shared state, timing, and brittle selectors are the test-file versions of the same three themes: correctness, async, readability. Correctly *declining* to flag something is as high-signal as catching a real bug.
