---
title: Software Delivery Pipeline Assignment — SEIS 616
description: SEIS 616 HW — CloudFormation template for a GitHub → CodePipeline → CodeBuild pipeline over a small Python app, with a manual approval stage that emails the maintainer and pauses until approved; verify via CLI, publish to a new GitHub repo, tear down, and submit a verification report.
status: completed
priority: high
owner: Aaron
created: 2026-11-01
tags:
  [
    aws,
    cloudformation,
    codepipeline,
    codebuild,
    sns,
    github,
    python,
    ci-cd,
    assignment,
    seis-616,
  ]
related_projects: [2026-09-25-corpweb-cloudformation-assignment.project.md]
---

# Software Delivery Pipeline Assignment — SEIS 616

## Summary

Build an automated delivery pipeline (GitHub → CodePipeline → CodeBuild) as a CloudFormation template, and add a **manual review stage**: after code is pushed, the pipeline pauses, the maintainer gets an email, and it resumes only after approval. Instead of the class `java-project`, the pipeline builds and tests a small **Python** app that lives in the same new repo.

- **Assignment:** `repositories/ai-driven-cloud-infrastructure/assignments/HW - Software Delivery Pipeline.pdf`
- **AWS account:** **762760349846**, CLI profile `aaron@gesm4267` (always pass `--profile aaron@gesm4267`; `default` is 908027408892)
- **Submission repo:** `repositories/seis616-delivery-pipeline/` → `https://github.com/bucky-badger-gesmer/seis616-delivery-pipeline` (public; new)
- **Report:** `README.md` in the submission repo (raw evidence logs in `repositories/ai-driven-cloud-infrastructure/assignments/hw-pipeline-evidence/`)
- **GitHub connection:** existing CodeConnections connection `arn:aws:codeconnections:us-east-1:762760349846:connection/ce137fc1-9d09-4798-991b-863061906edc` (status AVAILABLE, used by today's console CodeBuild test). No PAT, no Secrets Manager.

**Pipeline:**

```
git push (main)
  │  CodeConnections (GitHub App)
  ▼
Source ──► Approval (Manual) ──► Build (CodeBuild)
              │ SNS topic → email          │ pytest (JUnit report) + zipapp
              │ pauses until approved      ▼
              ▼ reject = execution stops   S3 artifact bucket: dist/rectangle.pyz
```

## Findings (2026-11-01 console CodeBuild test)

From inspecting the console-created project `gesmer-java-project` in 762760349846 before planning:

- **Builds work both ways.** Manual "Start build" (`c64eec7a`) and a push to `master` (`b3634bfb`, initiator `GitHub-Hookshot`) both **SUCCEEDED** in ~20 s: 4/4 JUnit tests, `rectangle.jar` zipped to `s3://cf-templates-tx49p2b8cadw-us-east-1/`. The `amazonlinux-x86_64-standard:6.0` image ships Ant.
- **Pushes trigger builds; PRs need approval.** The webhook has no filter groups (every push and PR). PR builds wait for a comment approval from a GitHub write/maintain/admin user.
- **Nothing shows in GitHub Actions — expected.** Actions only runs `.github/workflows/`; CodeBuild runs in AWS. GitHub-side evidence is the webhook's Recent Deliveries (200 OK) or commit status checks, which are **off** (`reportBuildStatus: false`). The console build history needs a manual refresh.
- **Service role needs no changes.** The console auto-created `codebuild-gesmer-java-project-service-role` with `CodeBuildBasePolicy-…` (log group, artifact bucket, `codepipeline-us-east-1-*` buckets, report groups) and `CodeBuildCodeConnectionsSourceCredentialsPolicy-…` (`codeconnections:UseConnection` on the GitHub connection). Least-privilege and sufficient. Hand edits are only needed when the build does more: new artifact bucket, AWS calls in the buildspec, ECR, secrets, or a pipeline/deploy step.
- **Why the professor touched IAM:** most likely reused an existing role, changed the artifact bucket after creation (the auto policy doesn't follow), added pipeline/deploy steps, or the walkthrough predates auto-attached policies.
- **Secrets Manager not needed.** The professor most likely connected GitHub with a personal access token, which the console stores in Secrets Manager and the role must be allowed to read. This account uses a **CodeConnections (GitHub App)** credential (`authType: CODECONNECTIONS`, connection `bucky-badger-gesmer-github`, AVAILABLE) and has **no secrets** in Secrets Manager.
- **Artifact bucket is the CloudFormation auto bucket** (`cf-templates-…`). Works, but the pipeline template uses its own bucket.

## Open questions

- [x] Professor OK with a Python app instead of the class `java-project`? **Yes** ("we can do whatever we want").
- [x] Approve **pytest** as the one dev dependency? **Yes.**
- [x] Which email receives approval notifications (`MaintainerEmail`)? **<maintainer email>**

## Requirements

From the PDF — each maps to a verification check in Phase 5.

- [x] Pipeline uses GitHub, CodeBuild, and CodePipeline
- [x] Manual review stage after code check-in: pipeline pauses there
- [x] Maintainer is notified to review the changes (SNS email)
- [x] Pipeline resumes only after the changes are approved
- [ ] New GitHub repository with the template files; URL submitted on Canvas (repo done; Canvas pending)
- [x] Report: how it was verified (CLI or browser), including the outputs
- [x] All AWS resources terminated afterward

## Decisions

| Gap | Decision | Why |
| --- | --- | --- |
| Assignment says "pipeline created in the class" (Java/Ant `java-project`) | Build a small Python app instead, in the new repo | Aaron's choice; the graded part is the pipeline + approval stage, not the app |
| Console vs. "template files" | One CloudFormation YAML template `pipeline.yaml` | PDF asks for template files; one-command deploy and teardown, same as the CorpWeb HW |
| Approval placement | Source → **Approval** → Build | PDF: "after checking in the code, the pipeline paused in this stage" |
| Notification | `AWS::SNS::Topic` + email subscription (`MaintainerEmail` parameter = <maintainer email>), referenced by the approval action's `NotificationArn` | Native approval notification; one manual step: confirm the subscription email |
| GitHub auth | Existing CodeConnections connection ARN as a parameter | Already proven working; no token to store or rotate |
| Pipeline type | CodePipeline **V2**, trigger on push to `main`, exclude `README.md` and docs from the file-path filter | Report commits shouldn't kick off runs that wait for approval |
| Python app | `rectangle` package (area/perimeter, mirrors the class Java app) + pytest tests | Small, testable, recognizable to the grader |
| Python dependencies | **pytest only** (dev, installed in CodeBuild) — approved by Aaron 2026-11-01 | Only thing not in the stdlib |
| Build artifact | `python -m zipapp` → `dist/rectangle.pyz` | Stdlib, single-file runnable artifact; the Python analog of `rectangle.jar` |
| Build image / runtime | `aws/codebuild/amazonlinux-x86_64-standard:5.0`, `python: 3.12` | Verify the runtime is supported on the chosen image in Phase 2; adjust if not |
| Test reporting | `pytest --junitxml` + buildspec `reports:` → CodeBuild report group | Gives clean pass/fail evidence for the report |
| Template repo layout | App, `buildspec.yml`, and `pipeline.yaml` in the same repo | One repo satisfies "new repo with template files" and is the pipeline source |
| Console project from 2026-11-01 (`gesmer-java-project`) | Not reused; deleted in teardown | Its job (prove connection/buildspec flow) is done; template creates its own |

## Implementation Plan

### Phase 1: Repo + Python app

- [x] Create public repo `bucky-badger-gesmer/seis616-delivery-pipeline`; add as kosmos submodule `repositories/seis616-delivery-pipeline`
- [x] `rectangle/__init__.py`, `rectangle/__main__.py` (CLI: `python rectangle.pyz 3 4`)
- [x] `tests/test_rectangle.py` (4+ tests)
- [x] `requirements-dev.txt` (`pytest`)
- [x] `buildspec.yml`: install `python 3.12` + `pip install -r requirements-dev.txt`; pre_build `pytest --junitxml=reports/junit.xml`; build: stage `rectangle/` into `build/`, `python -m zipapp build -m 'rectangle.__main__:main' -o dist/rectangle.pyz --compress`, smoke-run it; `PYTHONDONTWRITEBYTECODE=1` so no `__pycache__` lands in the artifact; `reports:` + `artifacts: dist/rectangle.pyz`
- [x] Run tests and the zipapp locally

### Phase 2: Author `pipeline.yaml`

- [x] Parameters: `ConnectionArn`, `RepositoryId` (`owner/repo`), `BranchName` (default `main`), `MaintainerEmail`
- [x] `ArtifactBucket` (S3, encrypted, public access blocked)
- [x] `ApprovalTopic` (SNS) + `ApprovalSubscription` (email)
- [x] `CodeBuildRole` (logs, artifact bucket, report group) + `BuildProject` (source/artifacts `CODEPIPELINE`)
- [x] `PipelineRole` (artifact bucket, `codeconnections:UseConnection`, `codebuild:StartBuild`/`BatchGetBuilds`, `sns:Publish`)
- [x] `Pipeline` (V2): Source (`CodeStarSourceConnection`) → Approval (`Manual`, `NotificationArn`, `CustomData`) → Build (`CodeBuild`); push trigger on `main` with file-path excludes
- [x] Outputs: pipeline name, console URL, artifact bucket, topic ARN
- [x] `aws cloudformation validate-template`; confirm the Python runtime/image pair

### Phase 3: Publish

- [x] Commit app + buildspec + template; push to `main` (repo must exist with code **before** `create-stack`: the pipeline runs Source immediately)
- [x] GitHub App access: if the AWS Connector app is installed for *selected* repos only, Aaron adds `seis616-delivery-pipeline` (GitHub → Settings → Applications → AWS Connector → Configure). `gh` can't list installations with this token, so check in the UI

### Phase 4: Deploy

- [x] `create-stack --capabilities CAPABILITY_IAM` from the GitHub copy of `pipeline.yaml`; wait for `CREATE_COMPLETE`
- [x] Aaron confirms the SNS subscription email
- [x] Log any failure + fix in Progress (none)

### Phase 5: Verify and capture evidence

- [x] **Reject path (initial execution):** the run started by pipeline creation stops at Approval (`get-pipeline-state`: Approval `InProgress`, Build not started). No email for this one, since the SNS subscription is still `PendingConfirmation`. `put-approval-result --result status=Rejected` → execution `Failed`, Build never ran. Reject **before** pushing anything (V2 default SUPERSEDED mode would hold a newer run behind it)
- [x] Aaron confirms the SNS subscription; `list-subscriptions-by-topic` shows a real subscription ARN
- [x] **Approve path:** push a code change → pauses at Approval → approval email arrives at <maintainer email> (screenshot) → approve (CLI or console) → Build `Succeeded`
- [x] CodeBuild report: tests passed. Artifact: download the random-named object under `<pipeline>/BuildOutput/` in the bucket, unzip, run `rectangle.pyz 3 4`
- [x] `list-pipeline-executions` showing both runs and their outcomes
- [x] README-only commit does **not** start an execution (trigger filter)

### Phase 6: Tear down

- [x] Empty `ArtifactBucket`, `delete-stack`, wait `DELETE_COMPLETE`
- [x] Delete runtime leftovers the stack doesn't own: log group `/aws/codebuild/<stack>-build` and report group `<stack>-build-pytest-reports`
- [x] Delete console project `gesmer-java-project`, its role `codebuild-gesmer-java-project-service-role` + its two policies, the `rectangle-*.zip` artifacts in `cf-templates-tx49p2b8cadw-us-east-1`, and its CloudWatch log group
- [x] Remove the CodeBuild webhook on `bucky-badger-gesmer/java-project` if still present
- [x] Keep the CodeConnections connection (free, reusable) — or delete if Aaron prefers
- [x] Confirm nothing left: stacks, pipelines, CodeBuild projects, report groups, log groups, buckets, SNS topics/subscriptions

### Phase 7: Report and submit

- [x] `README.md` report: architecture, template overview, requirement → resource table, verification steps with outputs, teardown
- [ ] Canvas: repo URL + report (Aaron)
- [x] Commit evidence logs in `ai-driven-cloud-infrastructure`; bump submodule pointers in kosmos

## Progress

- 2026-11-01: Created console CodeBuild project `gesmer-java-project` (GitHub `bucky-badger-gesmer/java-project` via CodeConnections). Manual build `c64eec7a` and push-triggered build `b3634bfb` (initiator `GitHub-Hookshot`) both **SUCCEEDED** (4/4 JUnit tests, `rectangle.jar` artifact). Confirms the connection, webhook, and auto-created service role work.
- 2026-11-01: Read the assignment PDF; switched the app to Python; project plan written.
- 2026-11-01: Open questions resolved: professor OK with Python, pytest approved, approvals go to <maintainer email>. Status → active.
- 2026-11-01: **Phase 1 (local) done** in `repositories/seis616-delivery-pipeline/` (git init, `main`, not yet on GitHub): `rectangle` package + CLI, 4 pytest tests (pytest 8.4.2 pinned), `buildspec.yml`. Local run: 4/4 passed, `dist/rectangle.pyz` (4 files: package + `__main__.py`) prints `area=12.0 perimeter=14.0`; bad args → usage, exit 1. Fixed two artifact issues found locally: zipping `.` would include repo files (now stages only `rectangle/`), and pytest left `__pycache__` in the zip (now `PYTHONDONTWRITEBYTECODE=1`).
- 2026-11-01: **Phase 2 template written**: `pipeline.yaml` (bucket, SNS topic + email sub, CodeBuild role/project, pipeline role, V2 pipeline Source → Approval `MaintainerReview` → Build `TestAndPackage`, push trigger on `main` excluding `README.md`/`docs/**`). `validate-template` OK (4 parameters, `CAPABILITY_IAM`). Still to prove at deploy: Python 3.12 on `standard:5.0`, approval `CustomData` variable substitution, exclude-only file-path trigger.
- 2026-11-01: **Phase 3 done** — committed `192d80e` (app, buildspec, `pipeline.yaml`). Aaron created the public repo and pushed from their own terminal (auto mode blocks Claude from creating public repos). Verified: https://github.com/bucky-badger-gesmer/seis616-delivery-pipeline is PUBLIC, `main` = `192d80e`, local tracks `origin/main`. Registered as kosmos submodule (`8b89add`). Next: confirm AWS Connector app can see the repo, then deploy.
- 2026-11-01: **Phase 4 deploy done** — stack `seis616-pipeline` created from the GitHub raw copy at `192d80e` (`cmp`-identical, SHA-256 `208ceab2…23ed3`), `CREATE_COMPLETE` first try, 6 resources, no failed events. Pipeline auto-started execution `acb33a38` (trigger `CreatePipeline`): Source Succeeded → Approval InProgress → Build not started. SNS subscription `PendingConfirmation`. Approval `CustomData`/`ExternalEntityLink` resolve `#{SourceVariables.*}` correctly. Python 3.12 on `standard:5.0` still unproven (no build yet).
- 2026-11-01: **Reject path verified** — `put-approval-result status=Rejected` at 16:13:41 UTC → Approval `Failed` ("Rejected for verification: reject path test"), execution `Failed`, CodeBuild project has 0 builds. Evidence: `repositories/ai-driven-cloud-infrastructure/assignments/hw-pipeline-evidence/verification-log.md` §1–8. **Stack live until Phase 6** (cost ≈ $0: V2 pipeline billed per action-minute, idle otherwise). Waiting on Aaron to confirm the SNS email.
- 2026-11-01: **Approve path verified** — SNS subscription confirmed (`…:b181444d`). Pushed `6fbc395` (adds `diagonal()` + test; 5/5 locally) → execution `e460dcae` (trigger `WebhookV2`) paused at Approval → Aaron approved in the console at 16:17:42 UTC ("Approved by arn:aws:iam::762760349846:user/aaron") → build `7410a910` Succeeded: **Python 3.12.15** on `standard:5.0`, 5/5 tests, report group `seis616-pipeline-build-pytest-reports` 5 SUCCEEDED. Artifact is at `seis616-pipeline/BuildOutpu/<random>` (CodePipeline truncates artifact folder names to 10 chars); downloaded, unzipped, `rectangle.pyz 3 4` → `area=12.0 perimeter=14.0 diagonal=5.0`. SNS metrics: 2 published, 2 delivered, 0 failed.
- 2026-11-01: **Trigger filter verified** — README-only push `6db9308` started no execution (still 2 runs after 75 s). Report drafted in the repo `README.md` (pushed `6db9308`; Test 3 section + Prettier fixes local, unpushed). Evidence log §9–18.
- 2026-11-01: Aaron confirmed the "APPROVAL NEEDED" email arrived.
- 2026-11-01: **Phase 6 done** — emptied artifact bucket; `seis616-pipeline` `DELETE_COMPLETE` at 16:23:39 UTC; deleted report group + log group for `seis616-pipeline-build`; deleted console project `gesmer-java-project`, its auto-discovered report group `gesmer-java-project-JUNITXML-AutoDiscovered`, log group, service role + 2 managed policies, and the 2 `rectangle-*.zip` in `cf-templates-…` (kept the older CorpWeb `corpweb.json` there). `delete-project` also removed the GitHub webhook on `java-project` (0 hooks). Orphan email subscription lingered after the topic was deleted → `sns unsubscribe`. Report groups sat in `DELETING` briefly, then 0. Final sweep: no stacks, pipelines, projects, report groups, `/aws/codebuild` log groups, SNS topics/subscriptions, or matching IAM roles/policies. Kept: CodeConnections `bucky-badger-gesmer-github` (AVAILABLE, free). Log: `hw-pipeline-evidence/teardown-log.md`.
- 2026-11-01: **Phase 7 report done** — README pushed (`ab360b0`): overview, repo/resource tables, deploy, review flow, 3 tests with outputs, teardown + sweep. Maintainer email masked as `<maintainer email>` in the public evidence logs and this file (README never had it). Remaining: Canvas submission.

## Review

All requirements met and verified in 762760349846; nothing billable left. Submit `https://github.com/bucky-badger-gesmer/seis616-delivery-pipeline` on Canvas (the README is the report).

Lessons:
- CodePipeline starts an execution on create, before anyone can confirm the SNS email. Use that first run for the reject test.
- CodePipeline truncates artifact folder names in S3 to 10 characters (`BuildOutpu/`).
- `delete-stack` leaves CodeBuild's log group and report groups behind, and can leave an orphaned email subscription. Sweep for them.
- Auto mode blocks Claude from creating public GitHub repos. The user runs `gh repo create` in their own terminal (a `!` command didn't run here).
- Running pytest before `zipapp` leaves `__pycache__` in the package. Set `PYTHONDONTWRITEBYTECODE=1`.

## Related

- Assignment: `repositories/ai-driven-cloud-infrastructure/assignments/HW - Software Delivery Pipeline.pdf`
- Lecture: `repositories/ai-driven-cloud-infrastructure/lectures/infrastructure-Change Management Pipelines for Infrastructure.pdf`
- Project: [[2026-09-25-corpweb-cloudformation-assignment.project.md]] — previous SEIS 616 HW; same account, runbook, and report style
