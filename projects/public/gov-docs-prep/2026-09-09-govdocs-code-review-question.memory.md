---
title: GovDocs Code Review Question — updateLocations
description: The "code review" snippet GovDocs asked in the 2025 interview (batch updateLocations with DB write + SNS notifications), plus prioritized review findings, positives, fixes, and test cases to rehearse for the 2026 re-interview
status: active
priority: high
owner: Aaron
created: 2026-09-09
tags: [govdocs, interview, code-review, nodejs, error-handling, sns, mongodb]
related_projects: [gov-docs-prep]
---

# GovDocs Code Review Question — updateLocations

## Summary

GovDocs gave this snippet as a "code review" exercise in the 2025 interview loop. Source copy lives at `personal/gov_docs_code_review.js`. This memory keeps the code and the review notes together so they can be rehearsed in one place before a similar question in 2026.

## The code

```js
const updateLocations = async ({
  locationsToUpdate,
  userOrProcessName,
  sendUpsertSns,
}) => {
  const updateLocationsResult = {};

  try {
    if (locationsToUpdate.length > 0) {
      const locationsBeforeUpdatesAsMap =
        await getLocationsBeforeUpdatesAsMap(locationsToUpdate);
      const locationsWithGeneratedFields = locationsToUpdate.map((location) =>
        populateSystemGeneratedFieldsForUpdate(
          locationsBeforeUpdatesAsMap.get(location._id.toString()),
          normalizeLocationData(location),
          userOrProcessName,
        ),
      );

      await locationsDBClient.updateLocations(locationsWithGeneratedFields);

      const updateNotifications = await buildUpdateNotifications({
        locationsBeforeUpdatesAsMap,
        locationsWithUpdates: locationsWithGeneratedFields,
        userOrProcessName,
      });
      await sendNotifications({ updateNotifications, sendUpsertSns });

      updateLocationsResult.updatedIds =
        updateNotifications.snsNotifications.map(
          (notification) => notification._id,
        );
    }
  } catch (error) {
    logger.error('Error updating locations ', error);
    updateLocationsResult.failureMessage = error.message;
    updateLocationsResult.failedLocations = locationsToUpdate;
  }

  return updateLocationsResult;
};

const getLocationsBeforeUpdatesAsMap = async (locations) => {
  const locationsIds = locations.map((location) => location._id);
  const locationsBeforeUpdates =
    await locationsDBClient.getLocations(locationsIds);

  const locationsBeforeUpdatesAsMap = new Map();
  locationsBeforeUpdates.forEach((location) => {
    locationsBeforeUpdatesAsMap.set(location._id.toString(), location);
  });

  return locationsBeforeUpdatesAsMap;
};
```

## Walkthrough Script (say this out loud, block by block)

**0. Orient first.** Look at the whole thing. Say:
> "Async function that updates a batch of locations. Flow is read, transform, write, notify, all in one try/catch. Let me go top to bottom."

**1. Signature.** Three params: the array, who is making the change, and an SNS flag.
> Ask: "Is `sendUpsertSns` a boolean? Who calls this?"

**2. Result object + `if (length > 0)`.** Builds a result and returns it instead of throwing.
> Nit: empty array returns `{}`. Prefer an early return over nesting. Undefined input throws on `.length` and gets caught as an "update failure."

**3. Snapshot read (the helper).** Pulls IDs, fetches current docs, builds a Map keyed on stringified ID.
> Praise: stringifying is right for ObjectIds.
> Ask: "Why do we need the before state? For diffing in notifications?"
> Plant: "If an ID isn't in the DB, it just won't be in the map. Nothing checks that."

**4. Transform (the `.map`).** Looks up the old doc, normalizes new data, merges system fields.
> Cash in: missing ID means `undefined` goes into the helper. Crash or bad doc. Validate before this step.
> Also: missing `_id` throws on `.toString()`. No input validation.

**5. DB write.** Persist the batch.
> Ask: "One transaction or per-doc? Batch size limit? Any version check?" (read-then-write race)

**6. Notify.** Build notifications from before/after, then send.
> Praise: write before notify is the right order.
> HEADLINE: if send throws, the DB write already happened. Catch reports everything as failed. Caller retries, we double-update and double-notify.

**7. `updatedIds`.** Comes from the notification payload, not the DB result.
> Root cause of the headline. Success is defined by notifying, not writing.
> Ask: "What is `snsNotifications` when the flag is false?"

**8. Catch.** Logs and stuffs failure onto the result.
> No IDs or user in the log. Only `error.message` kept, stack lost. `failedLocations` is always the whole batch.

**9. Close.** Rank out loud:
> Blocking: partial failure between write and notify. Split into two phases, report written IDs regardless, mention outbox pattern.
> Should fix: validate all IDs found.
> Nits: return shape, log context, early return.
> Test to name: notification fails after successful write, assert what the caller sees.

### Habits for any snippet

- Shape first, then lines.
- Describe each block neutrally, then flag.
- Raise unsure concerns as questions.
- Plant small observations early, cash them in later.
- The worst bug usually lives between two side effects. Look there first.
- Rank at the end: blocking, should-fix, nit.

## General Code Review Cheat Sheet (any snippet)

Read top to bottom. Describe each block, then flag. Let these buckets prompt you. Rank at the end: one blocking, a couple should-fix, rest are nits.

**1. Side-effect boundaries (look here first)**
- Two side effects in a row: what if the second fails after the first succeeds?
- Is "success" derived from the thing that actually persisted?
- Is a retry safe? Idempotency?
- Is anything announced before it's committed?

**2. Error handling**
- One catch-all around many steps hides which step failed.
- Return shape consistent across success / failure / empty?
- Logs missing IDs, user, correlation ID? Only `error.message` kept?
- One bad item fails the whole batch?
- Throws from `.length`, `.toString()`, property access on undefined?

**3. Data integrity and concurrency**
- Read-then-write with no version check.
- `.get()` on a Map can return undefined. Is that handled?
- Input validated at the boundary? Required fields, types, empty, null?
- 100 in, 97 back. Does anything notice?
- Multi-step write atomic, or can it half-succeed?

**4. Async**
- Missing `await`, especially inside `.map`.
- `forEach` with async callback never waits.
- Unbounded `Promise.all`. Concurrency limit?
- Check-then-act race without a unique constraint.

**5. Scale**
- DB call inside a loop (N+1).
- No chunking for large inputs.
- Everything loaded into memory.
- `.find()` or `.includes()` inside a loop over the same list. Use a Map or Set.

**6. Security**
- String-built queries, shell, or HTML from user input.
- Authenticated is not authorized. Does it check ownership?
- Secrets or PII in logs.
- Client-supplied fields that should be server-controlled (`createdBy`, `role`).
- Whole request body spread into an update.

**7. API shape**
- Boolean flag param usually means two functions hiding in one.
- Validation + persistence + notification in one function. Split?
- Mutates its inputs?

**8. Readability (call these nits)**
- Deep nesting. Prefer early returns.
- Naming. Magic values. Dead code.
- Imported clients and loggers instead of injected. Hard to test.

**9. "How would you test this?"**
- Happy path. Empty input. Null input.
- Each side effect failing, especially the second after the first succeeds.
- Lookup miss.
- Flag on / flag off.
- Concurrency: mention as design concern, don't promise a test.

**In the room**
- Shape first, then lines.
- Describe, then flag. Unsure? Ask it as a question.
- Praise something real.
- If there's no blocking issue, say so. That's a confident answer.

## Details

### How to run the review in the interview

- Restate what the code does first: snapshot current rows, merge system-generated fields, write to DB, build and send notifications.
- Ask clarifying questions before critiquing: who calls this, is the DB transactional, is a dropped SNS notification acceptable, is `sendUpsertSns` a boolean flag.
- Order findings by severity: correctness and data integrity, then error handling, then edge cases, then readability. Label nits as nits.
- Call out what's good.

### Findings, in priority order

1. **Partial failure misreports state.** DB write succeeds, then notification send throws. The catch marks every location failed and `updatedIds` is never set. Data is persisted but the caller is told nothing succeeded. A retry re-updates and re-notifies. Headline finding.
2. **`updatedIds` derived from the notification payload, not the DB result.** Success should be reported from what was written. This coupling causes finding 1.
3. **Missing "before" records not handled.** Map lookup returns `undefined` for IDs not in the DB and passes it into the field-populating helper. Crash or silent corruption. Validate every requested ID came back.
4. **No input validation.** Missing `_id` throws on `.toString()`; undefined `locationsToUpdate` throws on `.length`. Both are swallowed by the catch and reported as an "update failure."
5. **Failure attribution is all-or-nothing.** One bad doc fails the whole batch. Ask if per-item results are needed.
6. **Read-then-write race.** Snapshot, then write, with no version check. Concurrent modifications get overwritten. Suggest optimistic concurrency or a version field.
7. **Inconsistent return shape.** Empty input returns `{}`; success returns `updatedIds`; failure returns `failureMessage` and `failedLocations`. Suggest a consistent shape with an explicit success flag, or throw.
8. **Error logging loses context.** No IDs or `userOrProcessName` in the log; returning only `error.message` drops the stack and type.
9. **No batching.** Large arrays mean one giant IN query and one giant update.
10. **Hidden module-level dependencies.** DB client and logger are imported, not injected. Harder to test. Minor.

### Positives to praise

- Write before notify is the correct order. Never announce a change that hasn't been committed.
- `Map` keyed on stringified ID is right for ObjectId comparison and gives O(1) lookup.
- Snapshot helper is cleanly separated.
- Names are verbose but unambiguous.

### Fixes to suggest

- Guard clause for the empty array instead of nesting the whole body.
- Two phases: persist, then notify. Report `updatedIds` from the persist step even if notify fails, and surface notification failure separately.
- For guaranteed delivery, name the transactional outbox pattern.
- Validate all IDs were found; fail fast listing the missing ones.

### Test cases to name

- Happy path with two locations.
- Empty array returns cleanly.
- One ID not found in the DB.
- DB update throws.
- Notification send throws after a successful DB write; verify what the caller sees.
- `sendUpsertSns` false still returns updated IDs.

## Key Points

- Lead with the partial-failure finding.
- Ask one or two sharp clarifying questions before critiquing.
- Name the transactional outbox pattern.
- Praise the write-before-notify ordering and the Map lookup.

## Context

GovDocs re-interview, September 2026. A code review exercise like this one is likely to recur. Rehearse the structure, not just the findings, since the snippet may differ.

## Related Information

- Project: [[gov-docs-prep]]
- Source: `personal/gov_docs_code_review.js`
