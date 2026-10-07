---
title: Lambda Assignment — S3-Triggered Thumbnail Generator
description: >
  SEIS 615 assignment: build an event-driven image pipeline. A user uploads an
  image to a source S3 bucket, S3 publishes the ObjectCreated event to Lambda,
  and a Python function using Pillow (supplied as a Lambda layer) resizes the
  image and writes the thumbnail to a target bucket. Deliverable: a Canvas
  report with step-by-step instructions a reader can follow blind, plus cited
  references.
status: planning
priority: high
owner: Aaron
created: 2026-08-24
tags:
  [
    aws,
    lambda,
    s3,
    iam,
    serverless,
    event-driven,
    python,
    pillow,
    lambda-layers,
    assignment,
  ]
related_projects:
  [
    2026-08-13-cloudformation-assignment.project.md,
    2026-08-09-elasticity-availability-lab.project.md,
  ]
---

# Lambda Assignment — S3-Triggered Thumbnail Generator

## Summary

Build the five-step architecture from the assignment slide:

```
        ┌─────────────────────────── AWS Cloud ───────────────────────────┐
        │                                                                 │
 User ──1──▶ Source bucket ──2──▶ (ObjectCreated event) ──3──▶ AWS Lambda │
        │                                                          │      │
        │                                                          4  ◀── IAM role
        │                                                          ▼      │  + access policy
        │        Target bucket  ◀──5── Lambda function (Pillow resize)     │
        └─────────────────────────────────────────────────────────────────┘
```

1. User uploads an image to the **source** S3 bucket.
2. S3 detects the object-created event.
3. S3 publishes the event to Lambda.
4. Lambda runs the function, assuming an **IAM role**. Its attached policies — a
   custom **access policy** plus the AWS-managed `AWSLambdaBasicExecutionRole` —
   grant read on the source bucket, write on the target bucket, and CloudWatch Logs.
5. The function resizes the original and saves the thumbnail to the **target** bucket.

**The function code lives in the class repo:**
`repositories/cloud-computing-notes/labs/lambda/thumbnail-generator.py`

**Why two buckets:** if the function wrote thumbnails back into the source bucket,
each write would fire another ObjectCreated event, re-invoking the function in an
infinite (and billable) loop. Separate buckets break the cycle structurally. The
code also carries an explicit guard for this — see [Reading the code](#reading-the-code).

## Requirements

- [ ] Two S3 buckets — source and target — in **us-east-1**
- [ ] IAM **role** for Lambda: custom access policy (`s3:GetObject` on source, `s3:PutObject` on target) + AWS-managed `AWSLambdaBasicExecutionRole` for CloudWatch Logs
- [ ] Lambda function (Python) implementing the resize
- [ ] **Pillow** available to the function via a **Lambda layer** (Klayers)
- [ ] **S3 trigger**: ObjectCreated on the source bucket invokes the function
- [ ] End-to-end proof: upload an image → thumbnail appears in the target bucket
- [ ] **Deliverables:** Canvas report with step-by-step instructions + cited references

## Runbook — build the pipeline in an existing AWS account

> **This assumes the same AWS account you used for the earlier SEIS 615 labs** (IAM,
> S3 static website, EC2, VPC, RDS, CloudFormation, elasticity). Nothing here
> conflicts with what those labs left behind — every resource below is newly named
> and additive — but Step 0 has a short pre-flight because an account with history
> behaves differently from a fresh one in three specific ways.
>
> **What this costs.** Effectively nothing. Lambda's free tier is **perpetual and
> not tied to account age** — 1M requests + 400,000 GB-seconds every month, forever.
> S3's free tier *does* expire 12 months after account creation, but a handful of
> small objects costs fractions of a cent either way. Running this lab end-to-end
> is well under $0.01 regardless of how old your account is. There is no always-on
> resource here — nothing bills while you sleep, unlike the NAT gateway in the
> CloudFormation lab. Step 10 (cleanup) is therefore optional hygiene, not damage
> control.
>
> 📸 marks every screenshot the report needs.

### Step 0 — Pre-flight on an existing account

You have an AWS account already, so three things are worth 60 seconds before you start.

**1. Confirm you're signed in with permissions to create IAM roles.**
Step 4 requires `iam:CreatePolicy`, `iam:CreateRole`, and `iam:AttachRolePolicy`. If
you're using the root user or an admin IAM user, you're fine. If you're signed in as
a **limited IAM user created during the IAM assignment** (one with, say, only
`AmazonS3ReadOnlyAccess`), Step 4 will fail with `User is not authorized to perform:
iam:CreateRole`. Sign in as your admin identity instead. Check with IAM → **Users** →
your user → **Permissions**.

**2. Confirm nothing from an earlier lab is still billing.**
The CloudFormation lab's NAT gateway (~$32/mo if left up) and any running EC2
instances are the two things that quietly accumulate charges. Per
[[2026-08-13-cloudformation-assignment]] those stacks were torn down, but verify:

- **CloudFormation** → **Stacks** → filter *Active* — should be empty (a
  `CDKToolkit` or similar bootstrap stack is harmless).
- **EC2** → **Instances** → state `running` — should be empty.
- **VPC** → **NAT gateways** → should be empty.
- **Billing and Cost Management** → **Bills** → current month — a quick sanity check.

This isn't required for the Lambda lab; it's just the cheapest moment to catch a
$32/mo surprise.

**3. Expect name collisions and take them as information.**
Every name in this runbook is prefixed `seis615-thumbnail*`, which shouldn't collide
with prior labs. But if the console rejects a name as already in use, **don't force
it** — look at what's there first. A leftover role or bucket from a previous attempt
may still be wired to something. Append a suffix (`-v2`) rather than reusing or
deleting the existing resource blind.

**Also have on hand:**

- One or two image files on your laptop to test with (`.jpg` or `.png`, any size —
  a photo from your phone is ideal because it's large enough that the resize is
  obvious). Keep them under ~10 MB.
- A browser. **No local Python, no AWS CLI, and no ZIP packaging required** —
  everything below happens in the console, and Pillow arrives as a prebuilt layer.

### Step 1 — Sign in and set the region

1. Sign in to the AWS Management Console with the admin identity from Step 0.
2. Top-right region picker → **US East (N. Virginia) `us-east-1`**. Don't assume —
   the console remembers whatever region you were last in, which may be wherever the
   previous lab left you.

> **Why this region matters:** the Klayers Pillow layer you'll attach in Step 6 is a
> *regional* resource. A layer ARN from `us-east-1` cannot be attached to a function
> in `us-west-2`. Every resource in this lab must live in the same region.

### Step 2 — Create the source bucket

1. Console search bar → **S3** → **Create bucket**.
2. Fill in:

   | Field | Value |
   |---|---|
   | AWS Region | `us-east-1` |
   | Bucket type | `General purpose` |
   | Bucket name | `seis615-thumbnails-source-<your-initials><today>` — e.g. `seis615-thumbnails-source-ag0824` |
   | Object Ownership | leave `ACLs disabled (recommended)` |
   | Block Public Access | **leave all four boxes checked** |
   | Bucket Versioning | `Disable` |
   | Encryption | leave the default (`SSE-S3`) |

3. **Create bucket**.

> **Bucket names are globally unique across every AWS account on earth.** If you get
> `Bucket name already exists`, add more entropy (a birth year, a random number).
> Write your final name down — you'll type it several more times.
>
> Your account already has buckets from earlier labs (the static-website bucket, a
> `cf-templates-…` bucket CloudFormation created on upload). Leave them alone — these
> two are new and unrelated. Just make sure you don't accidentally pick one of them
> as the trigger source in Step 8.
>
> **Public access stays blocked.** Nothing in this architecture serves objects to
> the internet; Lambda reads and writes through the S3 API using its IAM role, which
> is unaffected by Block Public Access.

### Step 3 — Create the target bucket

Repeat Step 2 exactly, with the name `seis615-thumbnails-target-<your-initials><today>`.

📸 Screenshot the S3 **Buckets** list showing both buckets.

### Step 4 — Create the IAM role and its access policy

This is items 4's "IAM role" and "Access policy" on the assignment diagram. The
role is *what the function becomes* when it runs; the policy is *what that identity
is allowed to do*.

1. Console search bar → **IAM** → left sidebar **Policies** → **Create policy**.
2. Click the **JSON** tab and replace the entire contents with the following,
   substituting your two real bucket names:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ReadFromSourceBucket",
         "Effect": "Allow",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::seis615-thumbnails-source-ag0824/*"
       },
       {
         "Sid": "WriteToTargetBucket",
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::seis615-thumbnails-target-ag0824/*"
       }
     ]
   }
   ```

   > **The trailing `/*` is not optional.** `arn:aws:s3:::my-bucket` names the bucket
   > itself; `arn:aws:s3:::my-bucket/*` names the objects inside it. `GetObject` and
   > `PutObject` act on objects, so they need the `/*` form. Omitting it produces an
   > `AccessDenied` at runtime that is easy to misdiagnose.
   >
   > CloudWatch Logs permissions are deliberately absent here — the AWS-managed
   > `AWSLambdaBasicExecutionRole` policy you attach in substep 6 of this step supplies
   > them.

3. **Next** → Policy name: `seis615-thumbnail-s3-access` → **Create policy**.
4. Left sidebar **Roles** → **Create role**.
5. *Select trusted entity*: **AWS service** → Use case: **Lambda** → **Next**.

   > This choice writes the role's **trust policy** — the half of IAM that says
   > *who may assume this role*. Here it says `lambda.amazonaws.com` may. The
   > permissions policies below are the other half: *what the assumed role may do*.

6. *Add permissions*: search for and check **both**:
   - `seis615-thumbnail-s3-access` (the policy you just wrote)
   - `AWSLambdaBasicExecutionRole` (AWS-managed — lets the function write CloudWatch logs)

   → **Next**.
7. Role name: `seis615-thumbnail-lambda-role` → **Create role**.

📸 Screenshot the role's **Permissions** tab showing both policies attached.

### Step 5 — Create the Lambda function

1. Console search bar → **Lambda** → **Create function**.
2. Select **Author from scratch** and fill in **Basic information**:

   | Field | Value |
   |---|---|
   | Function name | `seis615-thumbnail-generator` |
   | Runtime | **Python 3.12** |

3. Expand **Additional settings** (below *Custom settings*) and set two things in the
   **General** block:

   | Toggle | Setting |
   |---|---|
   | **ARM64 architecture** | leave **off** — off means x86_64, the default |
   | **Custom execution role** | turn **on**, then pick `seis615-thumbnail-lambda-role` from the role picker that appears |

4. **Create function**.

> **The execution role is a toggle, not a radio button.** The AWS console reorganized
> this page: older tutorials (and the AWS docs) describe a *Permissions → Change
> default execution role → Use an existing role* section that no longer exists.
> The equivalent is now **Additional settings → General → Custom execution role**,
> described as *"Use custom execution role instead of new role with basic Lambda
> permissions (default)."* If you skip it, Lambda silently creates its own role with
> CloudWatch access only — the function will then fail at runtime with `AccessDenied`
> on `GetObject`, because your S3 policy isn't attached to that generated role.
>
> **Fallback if the toggle misbehaves:** create the function with the default role,
> then set it afterward at **Configuration → Permissions → Execution role → Edit →
> Use an existing role**. Identical end state.

> **Architecture is permanent; almost nothing else is.** Toggles marked with the ⋈
> icon (architecture among them) cannot be changed after the function is created —
> you would have to delete and recreate. Runtime, memory, timeout, environment
> variables, and layers are all editable later.
>
> **Note the runtime and architecture you picked** — Step 6's layer must match both.
> If you choose Python 3.13 or ARM64 here, you must pick the corresponding Klayers
> ARN. Mismatches fail at import time with `No module named 'PIL'`.

### Step 6 — Attach the Pillow layer

Pillow is a C-extension library, so it can't be pasted into the console editor and
isn't in the Lambda runtime by default. A **layer** is a ZIP of dependencies that
Lambda mounts read-only at `/opt` and puts on the Python path. Klayers publishes
prebuilt, public layers for common libraries.

1. Open <https://github.com/keithrozario/Klayers/tree/master/deployments> in a new tab.
2. Open the folder matching your runtime — **`python3.12`** — then the file
   **`arns/us-east-1.csv`** (layout: `deployments/<runtime>/arns/<region>.csv`; if the
   repo has been reorganized since, browse to the CSV for your region and runtime).
3. Find the row where the package is **`Pillow`** and copy its full ARN. It looks like:

   ```
   arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p312-Pillow:N
   ```

   > **Copy the ARN from the CSV rather than retyping the one above.** The trailing
   > `:N` is a version number that Klayers increments on every rebuild, and the
   > account ID differs by region. An ARN with a stale version number is rejected.

4. Back in the Lambda console, on your function's page, scroll to the bottom of the
   **Code** tab to the **Layers** panel → **Add a layer**.
5. Choose **Specify an ARN**, paste the ARN, click **Verify**, then **Add**.

📸 Screenshot the **Layers** panel showing the Pillow layer attached.

> **If Verify fails** (`layer version does not exist` / access denied): you copied
> from the wrong region's CSV, the version number is stale, or your function's
> runtime or architecture doesn't match the layer's. Recheck all three.

### Step 7 — Paste the code and configure the function

1. On the **Code** tab, open `lambda_function.py` in the editor.
2. Select all existing contents and replace them with
   `repositories/cloud-computing-notes/labs/lambda/thumbnail-generator.py`
   (reproduced in [Appendix A](#appendix-a--the-function-code)).
3. Click the **Deploy** button above the editor. Wait for *Changes deployed*.

   > **Deploy is not optional.** The console editor holds unsaved edits in the
   > browser; until you Deploy, the running function is still the placeholder AWS
   > generated. A surprising share of "my code doesn't work" is un-deployed code.
   >
   > **Leave the handler at its default `lambda_function.lambda_handler`.** That
   > string means *file `lambda_function.py`, function `lambda_handler`* — which is
   > exactly what you now have. Renaming either half breaks the entry point.

4. Open the **Configuration** tab → **Environment variables** → **Edit** → **Add
   environment variable**:

   | Key | Value |
   |---|---|
   | `TARGET_BUCKET` | `seis615-thumbnails-target-ag0824` (your real target bucket name) |

   → **Save**.

   > The code reads this with `os.environ["TARGET_BUCKET"]` at import time, so a
   > missing or misspelled key fails loudly on the first invocation instead of
   > silently writing somewhere unexpected.

5. Still on **Configuration** → **General configuration** → **Edit**:

   | Setting | Value | Why |
   |---|---|---|
   | Memory | **512 MB** | Pillow decodes the whole image into memory; the 128 MB default can OOM on a phone photo. Memory also scales CPU, so this is faster *and* often cheaper. |
   | Timeout | **30 sec** | The 3-second default isn't enough for a cold start plus an S3 download, decode, and upload. |
   | Ephemeral storage | leave at 512 MB | `/tmp` scratch space; ample for one image. |

   → **Save**.

📸 Screenshot the **General configuration** panel and the **Environment variables** panel.

### Step 8 — Add the S3 trigger

1. Back on the function's page, in the **Function overview** diagram at the top,
   click **+ Add trigger**.
2. Configure:

   | Field | Value |
   |---|---|
   | Source | **S3** |
   | Bucket | your **source** bucket |
   | Event types | **All object create events** (`s3:ObjectCreated:*`) |
   | Prefix / Suffix | leave both empty |
   | Recursive invocation acknowledgement | ✅ check the box |

3. **Add**.

> **What that acknowledgement checkbox is about:** AWS is warning you about exactly
> the infinite-loop hazard described in the Summary. Checking it asserts that the
> function does not write back into the bucket that triggers it. Because your target
> bucket is separate, that's true.
>
> **What this step created behind the scenes:** two things, not one. (a) An *event
> notification configuration* on the source bucket — visible under S3 → your source
> bucket → **Properties** → **Event notifications**. (b) A *resource-based policy*
> on the Lambda function granting `s3.amazonaws.com` permission to invoke it —
> visible under Lambda → **Configuration** → **Permissions** → *Resource-based
> policy statements*. Both are created for you here; if you ever wire this up via
> CLI or CloudFormation, you must create them yourself, and omitting (b) is the
> classic reason a trigger silently never fires.

📸 Screenshot the **Function overview** diagram showing S3 on the left as a trigger.

### Step 9 — Test end to end

1. S3 → your **source** bucket → **Upload** → **Add files** → pick a photo →
   **Upload**. Wait for *Upload succeeded*.
2. Breadcrumb → **Buckets** → your **target** bucket → refresh (⟳).
3. An object with **the same key** as what you uploaded should appear within a few
   seconds. Click it → **Open**. It's the same picture, now at most 128 px on its
   longest side.
4. Compare the **Size** column in both buckets — a multi-MB photo becomes a few KB.

📸 Screenshot: (a) the object in the source bucket, (b) the object in the target
bucket with its size visible, (c) the opened thumbnail itself.

**Now prove it from the logs**, which is the evidence that actually shows the event
chain firing:

5. Lambda → your function → **Monitor** tab → **View CloudWatch logs**.
6. Open the newest log stream. A successful invocation shows:

   ```
   START RequestId: ...
   [INFO]  Wrote thumbnail s3://seis615-thumbnails-target-ag0824/my-photo.jpg
   END RequestId: ...
   REPORT RequestId: ...  Duration: 1843.21 ms  Billed Duration: 1844 ms  Memory Size: 512 MB  Max Memory Used: 121 MB  Init Duration: 412.55 ms
   ```

📸 Screenshot this log output. The `REPORT` line is worth a sentence in the report:
`Init Duration` is the **cold start** (only present on the first invocation after a
deploy or idle period), and `Max Memory Used` justifies the 512 MB setting.

7. Upload a second image and re-check the logs — the new invocation has **no
   `Init Duration`**. That's a **warm start**: the execution environment was reused.
   This contrast is the cleanest demonstration of Lambda's execution model you can
   get in two uploads, and belongs in the report.

### Step 10 — Cleanup (optional)

Nothing here bills while idle, so cleanup is hygiene rather than cost control. If
you want the account tidy:

1. **S3** → each bucket → **Empty** (type `permanently delete` to confirm) → then
   **Delete**. Buckets must be empty before they can be deleted.
2. **Lambda** → function → **Actions → Delete**. This also removes the resource-based
   policy and the trigger.
3. **CloudWatch** → **Log groups** → delete `/aws/lambda/seis615-thumbnail-generator`.
   (Log data is what would otherwise accumulate a trivial ongoing charge.)
4. **IAM** → delete the role `seis615-thumbnail-lambda-role`, then the policy
   `seis615-thumbnail-s3-access`. Roles and policies are free — keep them if you
   plan to redo the lab.

> Do **not** delete the Klayers layer — it isn't yours; it lives in Klayers' account.

## Reading the code

Points worth explaining in the report rather than just pasting:

| Line of thinking | Why it's there |
|---|---|
| `unquote_plus(record["s3"]["object"]["key"])` | S3 URL-encodes object keys in event notifications: `my photo.jpg` arrives as `my+photo.jpg`. Calling `get_object` with the raw value returns `NoSuchKey`. This is the single most common bug in S3-triggered functions. |
| `for record in event["Records"]` | The event schema is a *list*. S3 usually delivers one record per invocation, but the contract permits batching — iterating is correct, indexing `[0]` is a latent bug. |
| `if source_bucket == TARGET_BUCKET: return` | Structural infinite-loop guard, in case someone later points the trigger at the target bucket. |
| Files written to `/tmp` | `/tmp` is the only writable path in the Lambda execution environment (512 MB default). |
| `uuid4().hex` in the temp filenames | Warm containers are reused across invocations and concurrent invocations share nothing but *can* be recycled — unique names prevent one invocation from reading another's leftovers. |
| `finally:` block removing temp files | `/tmp` persists across warm invocations. Without cleanup, a busy function eventually fills it and fails with `No space left on device`. |
| `image.thumbnail(size)` not `image.resize(size)` | `thumbnail()` preserves aspect ratio and never upscales; `resize()` distorts by forcing exact dimensions. |
| Extension allow-list | The trigger fires on *every* object created. Uploading a `.txt` would otherwise crash Pillow with `UnidentifiedImageError` and pollute the logs. |
| `boto3.client("s3")` at module scope | Module-level code runs once per cold start, not once per invocation. Creating the client here means warm invocations skip the setup entirely. |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unable to import module 'lambda_function': No module named 'PIL'` | Layer missing, or its runtime/architecture doesn't match the function's | Re-do Step 6 with the CSV row matching your exact runtime and architecture |
| `KeyError: 'TARGET_BUCKET'` | Environment variable not set or misspelled | Step 7.4 |
| `An error occurred (AccessDenied) when calling the GetObject operation` | Policy resource ARN missing the trailing `/*`, or the wrong bucket name | Step 4.2 |
| `An error occurred (NoSuchKey)` | Key not URL-decoded, or the object was deleted before the function ran | Confirm `unquote_plus` is present; retry the upload |
| `Task timed out after 3.00 seconds` | Timeout never raised from the default | Step 7.5 |
| `Runtime exited with error: signal: killed` / `Memory Size: 128 MB Max Memory Used: 128 MB` | Out of memory decoding a large image | Raise memory to 512 MB (Step 7.5) |
| Upload succeeds but **nothing at all appears in CloudWatch** — no log group, no streams | The trigger never fired. Either the notification isn't on the bucket, or Lambda's resource-based policy is missing | S3 → source bucket → **Properties → Event notifications** should list one. Lambda → **Configuration → Permissions** should show an `s3.amazonaws.com` statement. If either is absent, delete and re-add the trigger (Step 8) |
| Thumbnails appear in the **source** bucket and the function invokes forever | Trigger and `TARGET_BUCKET` point at the same bucket | **Remove the trigger immediately** to stop the loop, then fix the env var |

## Implementation Plan

### Phase 1: Build

- [ ] Steps 1–3: region + two buckets
- [ ] Step 4: IAM policy + role
- [ ] Steps 5–7: function, Pillow layer, code, env var, memory/timeout
- [ ] Step 8: S3 trigger

### Phase 2: Verify

- [ ] Step 9: upload → thumbnail in target bucket
- [ ] Step 9, items 5–7: CloudWatch logs, cold start vs. warm start
- [ ] Collect all 📸 screenshots

### Phase 3: Report

- [ ] Write the Canvas report from this runbook — architecture diagram, numbered steps, screenshots, code with explanation
- [ ] Include the [Reading the code](#reading-the-code) and [Troubleshooting](#troubleshooting) material — it's what makes the instructions followable "without any question"
- [ ] Attach `thumbnail-generator.py`
- [ ] Paste in the [References](#references) section
- [ ] Submit on Canvas

## Progress

- **2026-08-24** — Assignment read, architecture and runbook drafted, function code
  written to `repositories/cloud-computing-notes/labs/lambda/thumbnail-generator.py`.
  Not yet built in AWS.
- **Note on the code:** the assignment slide links to an instructor-provided
  `Thumbnail-generator.py`, but the link isn't resolvable from the PDF. The code here
  is an independent implementation of the same behavior. **Before submitting, pull the
  instructor's file from Canvas and compare** — if the class expects that exact code,
  swap it in and keep the [Reading the code](#reading-the-code) commentary.

## Review

_To be filled in after the build: what broke, what the real cold-start numbers were, anything the runbook got wrong._

## Appendix A — the function code

Source of truth: `repositories/cloud-computing-notes/labs/lambda/thumbnail-generator.py`

```python
"""
S3-triggered thumbnail generator.

Trigger:  ObjectCreated event on the source bucket.
Action:   download the object, resize it to a max 128x128 box (aspect ratio
          preserved), upload the result to the target bucket under the same key.

Requires the Pillow library, supplied as a Lambda layer (see the runbook).
Set the TARGET_BUCKET environment variable on the function.
"""

import os
import uuid
import logging
from urllib.parse import unquote_plus

import boto3
from PIL import Image

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

TARGET_BUCKET = os.environ["TARGET_BUCKET"]
THUMBNAIL_SIZE = (128, 128)
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp")


def resize_image(source_path, target_path):
    with Image.open(source_path) as image:
        image.thumbnail(THUMBNAIL_SIZE)  # preserves aspect ratio, resizes in place
        image.save(target_path)


def lambda_handler(event, context):
    for record in event["Records"]:
        source_bucket = record["s3"]["bucket"]["name"]
        # S3 URL-encodes keys in event notifications ("my photo.jpg" -> "my+photo.jpg")
        key = unquote_plus(record["s3"]["object"]["key"])

        if not key.lower().endswith(SUPPORTED_EXTENSIONS):
            logger.info("Skipping %s — not a supported image type", key)
            continue

        if source_bucket == TARGET_BUCKET:
            # Safety net: writing back into the source bucket would re-trigger
            # this function and loop forever.
            logger.error("Source and target buckets are identical — aborting")
            return

        # /tmp is the only writable location in the Lambda execution environment
        # (512 MB by default). The uuid keeps concurrent invocations from
        # colliding on the same filename.
        token = uuid.uuid4().hex
        download_path = f"/tmp/{token}-source"
        upload_path = f"/tmp/{token}-thumbnail{os.path.splitext(key)[1]}"

        try:
            s3.download_file(source_bucket, key, download_path)
            resize_image(download_path, upload_path)
            s3.upload_file(upload_path, TARGET_BUCKET, key)
            logger.info("Wrote thumbnail s3://%s/%s", TARGET_BUCKET, key)
        finally:
            for path in (download_path, upload_path):
                if os.path.exists(path):
                    os.remove(path)

    return {"status": "ok"}
```

## References

Cite these in the Canvas report (the assignment explicitly requires a reference list).

- Amazon Web Services. *Tutorial: Using an Amazon S3 trigger to create thumbnail images.* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/with-s3-tutorial.html>
- Amazon Web Services. *Using AWS Lambda with Amazon S3.* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html>
- Amazon Web Services. *Managing Lambda dependencies with layers.* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html>
- Amazon Web Services. *Defining Lambda function permissions with an execution role.* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html>
- Amazon Web Services. *Using resource-based policies for Lambda.* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/access-control-resource-based.html>
- Amazon Web Services. *Amazon S3 Event Notifications.* Amazon S3 User Guide. <https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html>
- Amazon Web Services. *Event notification content structure.* Amazon S3 User Guide. <https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html>
- Amazon Web Services. *Configuring Lambda function options (memory, timeout, ephemeral storage).* AWS Lambda Developer Guide. <https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html>
- Rozario, K. *Klayers: AWS Lambda layers for Python.* GitHub. <https://github.com/keithrozario/Klayers/tree/master/deployments>
- Python Pillow contributors. *Image Module — `Image.thumbnail`.* Pillow documentation. <https://pillow.readthedocs.io/en/stable/reference/Image.html>
- Amazon Web Services. *Boto3 S3 client — `download_file` / `upload_file`.* Boto3 documentation. <https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html>
- Course materials: `repositories/cloud-computing-notes/labs/Assignment – Lambda.pdf` (SEIS 615, University of St. Thomas).

## Related

- Project: [[2026-08-13-cloudformation-assignment]] — same account, prior assignment
- Code: `repositories/cloud-computing-notes/labs/lambda/thumbnail-generator.py`
