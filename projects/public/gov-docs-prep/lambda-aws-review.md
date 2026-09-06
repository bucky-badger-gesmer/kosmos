# AWS Lambda + Serverless Review

Last year they had you **walk through a Lambda function** live. Expect it again. This file makes you fluent on the execution model and the reasoning behind the "right shape" so you can narrate a function's problems and fixes out loud.

---

## Execution model (the core mental model)

A Lambda runs inside an **execution environment** (a micro-VM). Its lifecycle:

1. **Init phase** — download the deployment package, start the runtime, run **module-scope code** (everything outside the handler). Happens on a **cold start**.
2. **Invoke phase** — run the **handler** body. Happens every invocation.
3. **Shutdown** — environment frozen, then eventually torn down.

**The single most important consequence:** module-scope code runs **once per environment** and is reused across **warm** invocations. The handler runs **every** invocation.

```ts
// Module scope — runs once, reused across warm invocations
const client = new MongoClient(process.env.MONGO_URI!, { maxPoolSize: 10 });
const dbPromise = client.connect().then(c => c.db('compliance'));

export const handler: APIGatewayProxyHandler = async (event) => {
  const db = await dbPromise;   // reuses the warm connection
  // ...
};
```

This is why Snippet B's "new client inside the handler, closed at the end" is the headline bug: every invocation pays a fresh TCP+TLS handshake to Atlas and, under load, exhausts the cluster's connection limit. **Never call `client.close()`** — you want the pool to survive for the next warm invocation.

---

## Cold starts

**Cause:** a new execution environment must be initialized (package download + runtime init + module-scope code). Happens on first invoke, after scale-out, and after idle teardown.

**Reduce them by:**
- Shrinking the deployment bundle (tree-shake, avoid heavy SDK imports; import only the AWS SDK v3 clients you use).
- Moving reusable setup **into** module scope (connections, config) — cheap because it's amortized across warm invocations.
- **Provisioned concurrency** for latency-sensitive paths — keeps N environments warm. Tradeoff: you pay for them whether used or not.
- Keeping the runtime current; smaller memory-to-init work.

---

## Scaling & the downstream failure mode

Lambda scales **horizontally** — concurrency grows with load, one environment per concurrent invocation. Each environment holds **its own connection pool.**

**The classic failure:** a spiky workload spins up hundreds of environments, each opening connections, and a fixed-size database (Atlas tier, RDS) gets hammered into connection exhaustion.

**Mitigations:**
- Conservative `maxPoolSize` per function (each env × pool size = total connections).
- **Reserved concurrency** — caps how many environments a function can use (a throttle protecting downstream).
- **RDS Proxy** for relational DBs (pools connections outside Lambda).
- For Atlas, connection reuse + small pools + reserved concurrency.

---

## Memory / CPU / timeouts

- **Memory and CPU are coupled** — more memory = proportionally more vCPU. Over-provisioning memory can *lower* cost because the function finishes faster (billed on GB-seconds).
- **Timeout: 15 min max** for Lambda itself.
- **API Gateway caps at 29 seconds by default** (raisable by quota request since 2024, but treat 29 as the design constraint) — anything longer must be async with a status endpoint the client polls. This is *the* reason fan-out and bulk imports go to queues.

---

## Event sources & invocation types

- **Synchronous** (API Gateway, ALB, direct invoke) — caller waits for the response. No automatic retry; the caller handles failure.
- **Asynchronous** (S3, SNS, EventBridge) — Lambda queues the event and returns immediately. **Retries twice** on failure by default, then optionally to a **DLQ / on-failure destination.**
- **Poll-based / stream** (SQS, Kinesis, DynamoDB Streams) — Lambda polls and invokes in batches. SQS retries until the message succeeds, the visibility timeout expires enough times, or it hits the DLQ.

**Because retries exist, handlers must be idempotent.**

---

## Idempotency (raise this unprompted — it signals production experience)

A retried event must not double-charge, double-email, or double-insert. Techniques:
- **Dedupe key** with a **unique index** — e.g. `(customerId, lawChangeId, channel)`; the second write fails harmlessly.
- **Conditional writes / `upsert`** — write only if not already present.
- **Idempotency token** carried on the request.

---

## The "right shape" (be able to sketch this)

```ts
import { MongoClient, ObjectId } from 'mongodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

// module scope: constructed once, reused warm
const client = new MongoClient(process.env.MONGO_URI!, { maxPoolSize: 10 });
const dbPromise = client.connect().then(c => c.db('compliance'));

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const db = await dbPromise;

    // tenant from the verified authorizer context, NOT the query string (avoids IDOR)
    const tenantId = event.requestContext.authorizer?.tenantId;
    if (!tenantId) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const customer = await db.collection('customers').findOne({ _id: new ObjectId(tenantId) });
    if (!customer) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

    // single batched query + projection + limit (no N+1, bounded payload)
    const alerts = await db.collection('alerts')
      .find({ jurisdiction: { $in: customer.jurisdictions } })
      .project({ severity: 1, jurisdiction: 1, effectiveDate: 1 })
      .sort({ effectiveDate: -1 })
      .limit(100)
      .toArray();

    return { statusCode: 200, body: JSON.stringify({ alerts }) };
  } catch (err) {
    console.error({ msg: 'alerts.fetch.failed', tenantId: event.requestContext.authorizer?.tenantId, err });
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
```

When walking a Lambda, narrate in this order: **connection lifecycle → auth/tenant source → null checks → query shape (N+1? indexed? bounded?) → error handling → logging.**

---

## Two Mongo-and-Lambda gotchas you may see in the code they hand you

**`context.callbackWaitsForEmptyEventLoop`.** With a callback-style handler, Lambda waits for the Node event loop to drain before freezing the environment. A reused Mongo connection keeps a socket open, so the loop never drains and the function runs until it times out. The fix in older code is `context.callbackWaitsForEmptyEventLoop = false` at the top of the handler. With an `async` handler the response is sent when the promise resolves, so it is not needed, but you will still see the line in real handlers. It is not a bug. If you see a callback-style handler reusing a client *without* it, that is the bug.

**SQS partial batch failures.** An SQS-triggered Lambda receives up to 10 records per invocation. If the handler throws, the whole batch returns to the queue, including the records that succeeded, and they get reprocessed. The fix is to catch per record and report only the failures:

```ts
import { SQSHandler, SQSBatchItemFailure } from 'aws-lambda';

export const handler: SQSHandler = async (event) => {
  const batchItemFailures: SQSBatchItemFailure[] = [];
  for (const record of event.Records) {
    try {
      await processNotification(JSON.parse(record.body));
    } catch (err) {
      console.error({ msg: 'notify.record.failed', messageId: record.messageId, err });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
```

This only works if the event source mapping has `ReportBatchItemFailures` enabled. Say that out loud. A batch handler that throws on the first bad record is a common review plant, and it pairs with the idempotency point: the succeeded records that come back around must be safe to run twice.

---

## Observability in Lambda (ties to Datadog in the JD)

- **Structured JSON logs** with a request/correlation id — unstructured `console.log` is undebuggable at scale.
- **CloudWatch** metrics: invocations, errors, duration, **throttles**, concurrent executions.
- **DLQ depth** alarm — the signal that events are failing terminally.
- **X-Ray / Datadog APM** — distributed tracing across API Gateway → Lambda → Mongo.
- **`event` and `context`** — `context.awsRequestId` is your correlation id; `context.getRemainingTimeInMillis()` for time budgeting.

---

## Payload limits (whiteboard reasons)

- Lambda response payload: **6 MB** (sync).
- API Gateway payload: **10 MB**.
- These are why an unbounded result set (Snippet B, finding #7) fails for your largest customer only, and why bulk uploads go **direct to S3 via pre-signed URL**, not through a Lambda body.

---

## Security checklist for a Lambda review

- Tenant/authz from verified context, not user input (IDOR).
- Secrets from **Secrets Manager / Parameter Store**, not hardcoded; rotated. (An env var holding a connection string — ask where it comes from.)
- Least-privilege IAM execution role.
- Input validation on `event` before use.

---

## Quick self-check questions

1. Why declare the DB client outside the handler? What runs once vs every time?
2. How does Lambda scale, and what breaks downstream?
3. Why never call `client.close()` in this model?
4. API Gateway timeout vs Lambda timeout — and the design consequence?
5. Which event sources retry, and what does that force on your handler? (idempotency)
6. Give two idempotency techniques.
7. Why upload a 40k-row file to S3 directly instead of POSTing it to a Lambda?
8. How would you make a failing async Lambda debuggable in production?
