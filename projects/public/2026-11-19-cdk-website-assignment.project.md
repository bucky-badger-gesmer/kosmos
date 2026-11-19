---
title: CDK Website Assignment — SEIS 616
description: SEIS 616 HW — AWS CDK (Python, v2) app with a network stack (VPC, public + private subnet in each of 2 AZs) and a server stack (one web server per public subnet, RDS MySQL in the private subnets, web/RDS security groups, ALB); verify via CLI, publish to a new GitHub repo, tear down, and submit a verification report.
status: completed
priority: high
owner: Aaron
created: 2026-11-19
tags:
  [
    aws,
    cdk,
    python,
    iac,
    vpc,
    ec2,
    rds,
    mysql,
    alb,
    security-groups,
    assignment,
    seis-616,
  ]
related_projects:
  [
    2026-09-25-corpweb-cloudformation-assignment.project.md,
    2026-11-01-software-delivery-pipeline-assignment.project.md,
  ]
---

# CDK Website Assignment — SEIS 616

## Summary

Extend the class CDK lab ("Website on EC2 instance") into a two-stack CDK app. A **network stack** owns the VPC. A **server stack** takes that VPC and adds two web servers, an RDS MySQL instance, and an Application Load Balancer. Deploy it, prove it from the CLI, publish it to a new GitHub repo, destroy everything, and submit the repo URL plus a verification report on Canvas.

- **Assignment:** `repositories/ai-driven-cloud-infrastructure/assignments/HW - CDK.pdf`
- **Lab source:** `lectures/infrastructure-CDK practices.pdf` pp. 2-8 (single-instance lab) and pp. 47-49 (split into network + server stacks, pass the VPC as a constructor prop, `cdk deploy --all`)
- **AWS account:** **762760349846**, CLI profile `aaron@gesm4267`, region `us-east-1` (always pass `--profile aaron@gesm4267`; `default` is 908027408892)
- **Submission repo:** `repositories/seis616-cdk-website/` → `https://github.com/bucky-badger-gesmer/seis616-cdk-website` (public; new)
- **Report:** `README.md` in the submission repo (raw evidence logs in `repositories/ai-driven-cloud-infrastructure/assignments/hw-cdk-evidence/`)

**Architecture:**

```
Internet
  │ :80
  ▼
ALB (internet-facing, public subnets, AlbSG: 80 ← 0.0.0.0/0)
  │ listener :80 → target group (instance targets, health check GET /)
  ├────────────────────────────┐
  ▼                            ▼
web1 (Public AZ-a)           web2 (Public AZ-b)        WebSG: 80 ← 0.0.0.0/0
  │ :3306                      │ :3306
  └────────────┬───────────────┘
               ▼
RDS MySQL (subnet group = Private AZ-a + Private AZ-b)  DbSG: 3306 ← WebSG only

NetworkStack: VPC 10.0.0.0/16, 2 AZs, PUBLIC + PRIVATE_ISOLATED per AZ, 0 NAT gateways
ServerStack(vpc=network.vpc): WebSG, DbSG, AlbSG, web1, web2, RDS, ALB
```

## Requirements

From the PDF — each maps to a verification check in Phase 5.

- [x] Network stack: one public + one private subnet in one AZ
- [x] Network stack: one public + one private subnet in a second AZ
- [x] Server stack: one web server in each public subnet, using the CF assignment's user data
- [x] Server stack: RDS instance, MySQL engine, subnet group = all private subnets
- [x] Web servers' SG opens port 80 from anywhere
- [x] RDS SG opens 3306 **only** to the web servers' SG
- [x] Load balancer distributes requests across the web servers
- [ ] New GitHub repo with the project committed; URL submitted on Canvas (repo done; Canvas pending)
- [x] Report: how it was verified (CLI or browser), including the outputs
- [x] All AWS resources cleaned up

## Decisions

| Gap | Decision | Why |
| --- | --- | --- |
| Language | **Python**, CDK v2 (`aws-cdk-lib`) | Matches the lab (`cdk init app --language python`) |
| Python version for the venv | **3.13 via `uv`** (`uv venv --python 3.13`) | Homebrew only has 3.14/3.15; jsii/CDK support on 3.15 is unproven. Fall back to 3.14 if `uv` can't fetch 3.13 |
| Stack split and wiring | `NetworkStack` exposes `self.vpc`; `ServerStack(..., vpc=network.vpc)` in `app.py` | Exactly the lab's p.48 follow-up; CDK generates the cross-stack export |
| "Private" subnet type | `PRIVATE_ISOLATED`, `nat_gateways=0` | Nothing in the private tier needs the internet; a NAT gateway costs ~$1/day and the spec doesn't ask for one |
| Subnet layout | `max_azs=2`, `subnet_configuration` = Public `/24` + Private `/24` | Yields exactly 2 public + 2 private, one of each per AZ |
| Web server placement | Two explicit `ec2.Instance`s, `vpc_subnets=SubnetSelection(subnets=[vpc.public_subnets[i]])` | "One web server in each public subnet" is literal; an ASG wouldn't pin one per subnet |
| AMI | Amazon Linux 2023 (`MachineImage.latest_amazon_linux2023()`) | The CF user data uses `dnf`; AL2 (the lab's AMI) has no `dnf` |
| User data | CorpWeb's script verbatim (`dnf update`, install `git httpd php`, start httpd, `aws s3 cp s3://seis665-public/index.php /var/www/html/`) | PDF: "use the User Data Script from the CF assignment" |
| Instance role | Lab's role with `AmazonSSMManagedInstanceCore` + `s3:GetObject` on `arn:aws:s3:::seis665-public/*` | SSM gives shell access for the DB check with no key pair or port 22; the S3 grant is the same fix CorpWeb needed for `aws s3 cp` |
| Instance type | `t3.micro` | Free-tier eligible; t2 isn't available in every us-east-1 AZ |
| Load balancer | `elbv2.ApplicationLoadBalancer`, internet-facing, own SG; listener :80 → `InstanceTarget` for web1 + web2 | Lab practice: "let CDK manage security groups"; WebSG still opens 80 to anywhere per spec |
| RDS | `rds.DatabaseInstance`, MySQL **8.4.11** (RDS default), `db.t3.micro`, 20 GB, encrypted, single-AZ, not public | MySQL 8.0 is in paid RDS extended support since 2026-07; validator needs a full version; smallest valid config |
| DB credentials | `rds.Credentials.from_generated_secret("admin")` (Secrets Manager) | No password in code or in the public repo; secret deleted with the stack |
| Teardown-friendliness | RDS `removal_policy=DESTROY`, `deletion_protection=False`, `delete_automated_backups=True`, `backup_retention=0` | Lab practice (removal policies); `cdk destroy` leaves no snapshot behind |
| Stack outputs | `AlbDnsName` (http URL), `DbEndpoint`, `DbSecretArn`, web instance IDs | Evidence for the report |
| Tests | One `assertions.Template` test per stack (subnet count, SG rules, RDS subnet group) | The lab template ships a test file; lecture practice: "unit test your infrastructure" |
| Repo layout | Standard `cdk init` layout (`app.py`, `seis616_cdk_website/network_stack.py`, `seis616_cdk_website/server_stack.py`, `tests/unit/test_stacks.py`) | Grader recognizes it |
| CDK CLI install | Project-local: `aws-cdk@2.1149.0` pinned in `package.json` devDependencies, run with `npx cdk` | Aaron asked global vs project vs brew; pinned version travels with the repo, nothing global to drift |
| Stack environment | `account=CDK_DEFAULT_ACCOUNT`, `region` default `us-east-1`; `cdk.json` app runs `.venv/bin/python app.py` | AZ lookup picks us-east-1a/b (us-east-1e has no t3.micro); works for whoever deploys it |

## Open questions

- [x] **Dependencies:** approved 2026-11-19. CDK CLI project-local (not global/brew); venv has `aws-cdk-lib`, `constructs`, `pytest`.
- [ ] Due date? Not in the PDF; check Canvas.
- [x] Repo name `seis616-cdk-website` approved.

## Implementation Plan

### Phase 0: Prerequisites

- [x] Aaron re-authenticates `aaron@gesm4267` (`aws login --profile aaron@gesm4267`; session expired 2026-11-19)
- [x] Install the approved dependencies; `cdk --version`
- [x] Check bootstrap: `describe-stacks --stack-name CDKToolkit`; if missing, `cdk bootstrap aws://762760349846/us-east-1`

### Phase 1: Scaffold

- [x] `mkdir repositories/seis616-cdk-website && cdk init app --language python` (gives git repo + `.gitignore`)
- [x] `uv venv --python 3.13`, install `requirements.txt` + `requirements-dev.txt`
- [x] `cdk ls` shows the default stack

### Phase 2: Network stack

- [x] `NetworkStack`: `ec2.Vpc` 10.0.0.0/16, `max_azs=2`, `nat_gateways=0`, Public + PRIVATE_ISOLATED `/24`; expose `self.vpc`
- [x] Test: 4 subnets, 2 with `MapPublicIpOnLaunch`, 2 AZs, 0 NAT gateways

### Phase 3: Server stack

- [x] `ServerStack(vpc=...)`: WebSG (80 from `0.0.0.0/0`), DbSG (3306 from WebSG only, `allow_all_outbound=False`), AlbSG
- [x] Instance role (SSM + `s3:GetObject` on `seis665-public/*`)
- [x] `web1` / `web2` on AL2023 with the CorpWeb user data, one per public subnet
- [x] RDS MySQL in a subnet group of `vpc.isolated_subnets`, generated secret, teardown settings above
- [x] ALB + listener :80 + target group with both instances
- [x] Outputs
- [x] `app.py`: create `NetworkStack` then `ServerStack(vpc=network.vpc)`, both with `env` pinned to 762760349846/us-east-1
- [x] Tests: WebSG ingress, DbSG ingress source is WebSG (no CIDR), DB subnet group has 2 isolated subnets, ALB listener on 80
- [x] `pytest`, `cdk synth` clean, `cdk diff`

### Phase 4: Publish and deploy

- [x] Commit; create the public repo and push (Claude did it with `gh repo create`; not blocked this time); add as kosmos submodule
- [x] `cdk deploy --all --profile aaron@gesm4267` (RDS takes ~10 min); log any failure + fix in Progress (none)

### Phase 5: Verify and capture evidence

- [x] Subnets: `describe-subnets` by VPC → 2 public + 2 private, 2 AZs, route tables (public → IGW, private → local only)
- [x] Instances: one in each public subnet, `running`, status checks OK
- [x] SGs: `describe-security-groups` → WebSG 80 from `0.0.0.0/0`; DbSG 3306 from WebSG's group ID only
- [x] RDS: `describe-db-instances` → `mysql`, `available`, not publicly accessible, subnet group = the 2 private subnets
- [x] ALB: target health both `healthy`; `curl` the DNS name ~10 times → responses from both instances (index.php shows instance info)
- [x] DB reachability: SSM `send-command` on web1 → TCP connect to `DbEndpoint:3306` succeeds; same test from outside the VPC fails (not public)
- [x] Rebuild check: deploy from a fresh clone of the GitHub repo (`cdk synth` matches) so the published code is what was tested

### Phase 6: Tear down

- [x] `cdk destroy --all`; wait for both stacks `DELETE_COMPLETE`
- [x] Sweep: no instances, DB instances, DB snapshots, ALBs/target groups, the VPC, the DB secret (force-delete if pending deletion), leftover log groups
- [x] Keep `CDKToolkit` (bootstrap) unless Aaron wants it gone; if deleted, empty its asset bucket first (kept)

### Phase 7: Report and submit

- [x] `README.md`: architecture, stack/resource table, requirement → resource map, how to deploy, verification steps with outputs, teardown
- [x] Commit evidence logs in `ai-driven-cloud-infrastructure`; bump submodule pointers in kosmos
- [ ] Canvas: repo URL + report (Aaron)

## Progress

- 2026-11-19: Read the assignment PDF and the CDK lecture lab (Python, CDK v2, network/server split via constructor props). Committed the PDF in `ai-driven-cloud-infrastructure` (`28bfe65`). Plan written. `aws-cdk` CLI not installed; `aaron@gesm4267` session expired, so bootstrap status unchecked.
- 2026-11-19: **Phases 0-3 done** in `repositories/seis616-cdk-website/` (local git, `main`). CDK CLI 2.1149.0 project-local, venv Python 3.13.18 via `uv`. `NetworkStack` + `ServerStack` written; 5/5 unit tests pass; `cdk synth` clean after pinning MySQL `8.4.11` (validator rejected bare `8.4`) and enabling storage encryption. Subnets: public 10.0.0.0/24 (1a), 10.0.1.0/24 (1b); private 10.0.2.0/24 (1a), 10.0.3.0/24 (1b). Committed `88de095`. Bootstrapped `aws://762760349846/us-east-1` (`CDKToolkit`). `cdk deploy --all` started; log in `hw-cdk-evidence/deploy.log`.
- 2026-11-19: **Deploy + verify done.** Both stacks `CREATE_COMPLETE` first try (outputs in `hw-cdk-evidence/cdk-outputs.json`). All 10 CLI checks pass (`hw-cdk-evidence/verification-log.md`): 4 subnets 2/2 across 1a/1b, public → IGW, private local-only, 0 NAT; web1/web2 one per public subnet; WebSG 80 ← 0.0.0.0/0; DbSG 3306 ← WebSG only; RDS mysql 8.4.11 private, subnet group = both private subnets; both targets healthy; 10 curls hit both instance IDs; SSM from web1 → TCP 3306 open; workstation → 3306 fails (endpoint resolves to 10.0.3.209). Report in repo `README.md` (`24d0913`, Prettier `318fd32`). **Stacks live** (~$0.06/hr) until the GitHub copy is checked. Waiting on Aaron to create the repo and push.
- 2026-11-19: **Published.** Claude created the public repo with `gh repo create --public --source . --push` (worked; the delivery-pipeline HW block didn't recur). `main` = `318fd32`. Fresh clone: 5/5 tests, `cdk diff --all` → 0 stacks with differences.
- 2026-11-19: **Teardown done.** `cdk destroy --all --force` destroyed both stacks (14:39 UTC). Sweep: 0 Website* stacks, instances, RDS instances/snapshots/automated backups, LBs, target groups, secrets (incl. pending deletion), EIPs, Website* IAM roles; VPC NotFound. One orphan log group from CDK's `RestrictDefaultSG` custom-resource Lambda (0 bytes) deleted by hand. Kept `CDKToolkit`. Log: `hw-cdk-evidence/teardown-log.md`.
- 2026-11-19: **Report done** — README teardown section pushed (`88534c6`). Evidence committed in `ai-driven-cloud-infrastructure` (`509b8f6`); repo registered as kosmos submodule. Remaining: Canvas submission.
- 2026-11-19: **Screenshot pass.** Aaron redeployed, walked the console, and captured 10 screenshots (deploy outputs, stacks, subnets, instances, both SG inbound rules, RDS via CLI since the 2026 RDS console doesn't show Publicly accessible/subnets, browser hitting web1 and web2, stacks after teardown). README rewritten to short deploy / verify / tear down steps with the images (`7a238e4`, pushed). Aaron's destroy + manual log-group delete; sweep clean (only `CDKToolkit`). Remaining: Canvas submission.

## Review

All requirements met and verified in 762760349846; nothing billable left except the free-tier-scale `CDKToolkit` bootstrap stack. Submit `https://github.com/bucky-badger-gesmer/seis616-cdk-website` on Canvas (the README is the report).

Lessons:
- CDK's synth-time validator rejects a major-only RDS engine version (`8.4`); pin a full version (`8.4.11`).
- MySQL 8.0 on RDS is in paid extended support (since 2026-07); default new work to 8.4.
- `cdk destroy` leaves the log group for the VPC's `restrictDefaultSecurityGroup` custom-resource Lambda. Sweep for it.
- Project-local CDK CLI (`package.json` devDependency + `npx cdk`) and `cdk.json` app pointing at `.venv/bin/python` means no activation or global install is needed.
- zsh doesn't word-split `$P="--profile x --region y"`; use `AWS_PROFILE`/`AWS_REGION` env vars in sweep scripts.
- Try outward-facing commands before handing them to Aaron; the public-repo block from the last HW didn't recur.

## Related

- Assignment: `repositories/ai-driven-cloud-infrastructure/assignments/HW - CDK.pdf`
- Lectures: `repositories/ai-driven-cloud-infrastructure/lectures/infrastructure-CDK basics.pdf`, `infrastructure-CDK practices.pdf`
- Project: [[2026-09-25-corpweb-cloudformation-assignment.project.md]] — source of the user data and the S3 instance-role fix
- Project: [[2026-11-01-software-delivery-pipeline-assignment.project.md]] — same account, report, and teardown style
