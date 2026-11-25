---
title: Terraform Website Assignment — SEIS 616
description: SEIS 616 HW — Terraform config for a VPC with public + private subnets in 2 AZs, one web server per public subnet (names from instance1_name/instance2_name), RDS MySQL in the private subnets, web/RDS security groups, and an ALB; output instance public IPs plus ALB and RDS endpoints; verify via CLI, publish to a new GitHub repo, tear down, and submit a verification report.
status: completed
priority: high
owner: Aaron
created: 2026-11-25
tags:
  [
    aws,
    terraform,
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
    2026-11-19-cdk-website-assignment.project.md,
    2026-09-25-corpweb-cloudformation-assignment.project.md,
  ]
---

# Terraform Website Assignment — SEIS 616

## Summary

Build the same two-tier website as the CDK HW, this time in Terraform: VPC with a public and private subnet in each of two AZs, one web server per public subnet, RDS MySQL in the private subnets, an ALB in front of the web servers. New this time: the instance names come from input variables `instance1_name` / `instance2_name`, and outputs must include both instance public IPs, the ALB endpoint, and the RDS endpoint. Apply it, prove it from the CLI, publish to a new GitHub repo, destroy everything, and submit the repo URL plus a verification report on Canvas.

- **Assignment:** `repositories/ai-driven-cloud-infrastructure/assignments/HW - Terraform.pdf`
- **Lecture:** `repositories/ai-driven-cloud-infrastructure/lectures/infrastructure-terraform.pdf` — labs: AWS instance (pp. 23-34), change infra (pp. 35-38), input variables (pp. 39-47), outputs (pp. 48-53). Lecture gives no VPC/SG/ALB/RDS/user-data patterns; those come from the CDK HW design.
- **AWS account:** **762760349846**, CLI profile `aaron@gesm4267`, region `us-east-1` (`AWS_PROFILE=aaron@gesm4267`; `default` is 908027408892)
- **Submission repo:** `repositories/seis616-terraform-website/` → `https://github.com/bucky-badger-gesmer/seis616-terraform-website` (public; new)
- **Report:** `README.md` in the submission repo (raw evidence logs in `repositories/ai-driven-cloud-infrastructure/assignments/hw-terraform-evidence/`)

**Architecture:**

```
Internet
  │ :80
  ▼
ALB (internet-facing, both public subnets, alb SG: 80 ← 0.0.0.0/0)
  │ listener :80 → target group (instance targets, health check GET /)
  ├────────────────────────────┐
  ▼                            ▼
var.instance1_name           var.instance2_name         web SG: 80 ← 0.0.0.0/0
(public subnet AZ-a)         (public subnet AZ-b)
  │ :3306                      │ :3306
  └────────────┬───────────────┘
               ▼
RDS MySQL (aws_db_subnet_group = private AZ-a + private AZ-b)   db SG: 3306 ← web SG only

VPC 10.0.0.0/16 · IGW · public RT (0.0.0.0/0 → IGW) · private RT (local only) · no NAT
outputs: instance1_public_ip, instance2_public_ip, alb_dns_name, rds_endpoint
```

## Requirements

From the PDF — each maps to a verification check in Phase 5.

- [x] One public + one private subnet in one AZ
- [x] One public + one private subnet in a second AZ
- [x] One web server in each public subnet, using the CF assignment's user data
- [x] RDS instance, MySQL engine, subnet group = all private subnets
- [x] Web servers' SG opens port 80 from anywhere
- [x] RDS SG opens 3306 **only** to the web servers' SG
- [x] EC2 instance names come from input variables `instance1_name` and `instance2_name`
- [x] Load balancer distributes requests across the web servers
- [x] Outputs: public IPs of both EC2 instances, load balancer endpoint, RDS endpoint
- [ ] New GitHub repo with the project committed; URL submitted on Canvas (repo done; Canvas pending)
- [x] Report: how it was verified (CLI or browser), including the outputs
- [x] All AWS resources cleaned up

## Decisions

| Gap                     | Decision                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terraform CLI           | HashiCorp's tap via Homebrew, two steps: `brew tap hashicorp/tap`, then `brew install hashicorp/tap/terraform` (current 1.x)                                                                                                                                                                                                                                               | Homebrew core's `terraform` is frozen at 1.5.7 (license change); the tap is HashiCorp's official channel. Needs approval (dependency)                                                                            |
| File layout             | `versions.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars`, `user_data.sh`                                                                                                                                                                                                                                                                                 | Lecture uses `main.tf` / `variables.tf` / `outputs.tf`; `versions.tf` + `user_data.sh` keep main readable                                                                                                        |
| Modules                 | Raw `resource` blocks, no registry modules                                                                                                                                                                                                                                                                                                                                 | Lecture labs use raw resources; grader sees each requirement as a named resource                                                                                                                                 |
| Provider pin            | `hashicorp/aws ~> 6.0`, `required_version >= 1.2.0`; commit `.terraform.lock.hcl`                                                                                                                                                                                                                                                                                          | Lecture pins `~> 4.16`, which is years old and lacks current RDS/ALB args; same "pin a major" practice                                                                                                           |
| Credentials             | No profile in code; `region` variable defaulting to `us-east-1`. Every `apply` / `destroy` is chained behind an account guard: `export AWS_PROFILE=aaron@gesm4267 && [ "$(aws sts get-caller-identity --query Account --output text)" = 762760349846 ] && terraform ...`                                                                                                   | Lecture keeps credentials out of the provider block; keeps the public repo portable; a dropped `AWS_PROFILE` would hit default account 908027408892                                                              |
| State                   | Local `terraform.tfstate`, gitignored with `.terraform/`, `*.tfstate*`, `*.tfplan`                                                                                                                                                                                                                                                                                         | Lecture uses local state; state holds sensitive values and must not reach the public repo                                                                                                                        |
| Instance name variables | `instance1_name` / `instance2_name` (`type = string`, description, defaults `web-server-1` / `web-server-2`); `terraform.tfvars` sets `seis616-web-1` / `seis616-web-2`                                                                                                                                                                                                    | Exact names from the PDF; lecture style (description + type + default); tfvars shows the override in action                                                                                                      |
| Subnet layout           | `aws_subnet` × 4 with explicit `/24`s: public 10.0.0.0/24 (AZ-a), 10.0.1.0/24 (AZ-b); private 10.0.2.0/24 (AZ-a), 10.0.3.0/24 (AZ-b); public subnets set `map_public_ip_on_launch = true`; AZs from `data "aws_ec2_instance_type_offerings"` (`instance-type = t3.micro`, `location_type = "availability-zone"`), `sort(...locations)`, take `[0]` and `[1]`               | Matches the CDK HW layout; Terraform subnets don't assign public IPs by default (IP outputs would be empty, user data would have no internet); us-east-1e has no t3.micro; sorting keeps AZs stable between runs |
| Private subnet routing  | Own route table, local only, no NAT gateway                                                                                                                                                                                                                                                                                                                                | Nothing private needs the internet; NAT costs ~$1/day                                                                                                                                                            |
| AMI                     | `data "aws_ssm_parameter"` `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`; instances set `lifecycle { ignore_changes = [ami] }`                                                                                                                                                                                                                   | Lecture's hardcoded Ubuntu AMIs are stale; CF user data uses `dnf` (AL2023); ignoring AMI changes stops a new AL2023 release from planning a replacement mid-verification                                        |
| User data               | CorpWeb script verbatim (`dnf update`, `git httpd php`, start httpd, `aws s3 cp s3://seis665-public/index.php /var/www/html/`)                                                                                                                                                                                                                                             | PDF: "use the User Data Script from the CF assignment"                                                                                                                                                           |
| Instance role           | IAM role + instance profile with `AmazonSSMManagedInstanceCore` and `s3:GetObject` on `arn:aws:s3:::seis665-public/*`                                                                                                                                                                                                                                                      | SSM gives the DB-reachability test without a key pair or port 22; S3 grant is the fix CorpWeb needed                                                                                                             |
| Instance type           | `t3.micro`                                                                                                                                                                                                                                                                                                                                                                 | Free-tier eligible; lecture's `t2.micro` isn't in every us-east-1 AZ                                                                                                                                             |
| Load balancer           | `aws_lb` (application, internet-facing, both public subnets, own SG), `aws_lb_target_group` (HTTP :80, health check `/`), two `aws_lb_target_group_attachment`, `aws_lb_listener` :80                                                                                                                                                                                      | Same shape as CDK HW; web SG still opens 80 to anywhere per spec                                                                                                                                                 |
| RDS                     | `aws_db_instance` `engine_version = "8.4"` (RDS picks the default minor; the provider compares against `engine_version_actual` by prefix, so no drift; if the fresh-clone plan shows an `engine_version` diff, pin the full version RDS reports), `db.t3.micro`, 20 GB, encrypted, single-AZ, `publicly_accessible = false`, `aws_db_subnet_group` of both private subnets | MySQL 8.0 is in paid extended support; smallest valid config                                                                                                                                                     |
| DB credentials          | `manage_master_user_password = true` (RDS-managed Secrets Manager secret), username `admin`                                                                                                                                                                                                                                                                                | No password in code, tfvars, or the public repo                                                                                                                                                                  |
| Teardown-friendliness   | `skip_final_snapshot = true`, `deletion_protection = false`, `delete_automated_backups = true`, `backup_retention_period = 0`                                                                                                                                                                                                                                              | `terraform destroy` leaves no snapshot or backup behind                                                                                                                                                          |
| Outputs                 | `instance1_public_ip`, `instance2_public_ip`, `alb_dns_name` (plus `alb_url` = `http://...`), `rds_endpoint` = `aws_db_instance.address` (bare hostname, what the console calls "Endpoint"), `rds_port`; each with a description                                                                                                                                           | PDF requires IPs + LB + RDS endpoints; lecture adds descriptions; `.endpoint` is `host:3306`, which would break the `:3306` connectivity test                                                                    |
| Security group egress   | `aws_vpc_security_group_egress_rule`: `web` all traffic to `0.0.0.0/0`; `alb` tcp 80 to the `web` SG; `db` none                                                                                                                                                                                                                                                            | Terraform removes AWS's default allow-all egress from SGs it creates; without these, user data (`dnf`, S3), SSM, and ALB health checks all fail                                                                  |
| Resource ordering       | `depends_on = [public route table associations]` on `aws_lb` and both `aws_instance`s                                                                                                                                                                                                                                                                                      | Otherwise the ALB can fail with "VPC has no internet gateway" and instances can boot before the public route exists (user data fails silently); also orders destroy correctly                                    |
| Cost while live         | ~$0.08/hr (ALB, `db.t3.micro`, 2 × `t3.micro`, public IPv4s, secret); apply → verify → destroy in one session                                                                                                                                                                                                                                                              | Don't leave it running waiting on Aaron, as happened in the CDK HW                                                                                                                                               |
| Tags                    | `default_tags` on the provider: `Project = seis616-terraform-website`                                                                                                                                                                                                                                                                                                      | One filter for the teardown sweep                                                                                                                                                                                |
| Checks before apply     | `terraform fmt -check`, `terraform validate`, `terraform plan -out website.tfplan`                                                                                                                                                                                                                                                                                         | Lecture teaches fmt/validate; saved plan is report evidence; the `.tfplan` suffix matches `.gitignore` (a bare `tfplan` would not, and plan files hold state values)                                             |

## Open questions

- [x] **Dependency approval:** install Terraform via `brew tap hashicorp/tap && brew install hashicorp/tap/terraform`?
- [ ] Due date? Not in the PDF; check Canvas.
- [x] Repo name `seis616-terraform-website` OK?

## Implementation Plan

### Phase 0: Prerequisites

- [x] Approval + install Terraform; `terraform version`
- [x] Confirm `aws sts get-caller-identity --profile aaron@gesm4267` returns 762760349846 (re-auth if expired)

### Phase 1: Scaffold

- [x] `mkdir repositories/seis616-terraform-website && git init -b main`
- [x] `.gitignore` (`.terraform/`, `*.tfstate*`, `*.tfplan`, `crash.log`), `versions.tf`, provider with `default_tags`
- [x] `terraform init`; commit `.terraform.lock.hcl`

### Phase 2: Network

- [x] VPC (DNS hostnames on), IGW, 2 public (`map_public_ip_on_launch = true`) + 2 private subnets across 2 sorted t3.micro AZs, public RT → IGW, private RT local only, associations
- [x] `fmt` / `validate` / `plan` show 4 subnets, 0 NAT

### Phase 3: Compute, database, load balancer

- [x] SGs: `alb` (80 ← 0.0.0.0/0), `web` (80 ← 0.0.0.0/0), `db` (3306 ← `web` SG id only, no CIDR); use `aws_vpc_security_group_ingress_rule` resources
- [x] Egress: `web` all → `0.0.0.0/0`; `alb` tcp 80 → `web` SG (`aws_vpc_security_group_egress_rule`)
- [x] IAM role + instance profile (SSM + S3 read)
- [x] `aws_instance.web1` / `web2`: AL2023 from the SSM parameter, `ignore_changes = [ami]`, one per public subnet, `Name = var.instance1_name` / `var.instance2_name`, CorpWeb user data, `depends_on` public RT associations
- [x] DB subnet group (both private subnets) + `aws_db_instance` MySQL `"8.4"` with teardown settings
- [x] ALB (`depends_on` public RT associations) + target group + 2 attachments + listener :80
- [x] `variables.tf`, `terraform.tfvars` (committed), `outputs.tf` (`rds_endpoint` = `.address`, `rds_port`)
- [x] `fmt -check`, `validate`, `plan -out website.tfplan` clean; save plan summary

### Phase 4: Publish and apply

- [x] Pre-push gate: `git ls-files` shows no `*.tfplan`, `*.tfstate*`, or `.terraform/` files
- [x] Commit; `gh repo create seis616-terraform-website --public --source . --push` (try it first; hand to Aaron only if denied); add as kosmos submodule
- [x] Account guard, then `terraform apply website.tfplan` (RDS ~10 min); log in `hw-terraform-evidence/apply.log`; record any failure + fix in Progress, and push fixes before Phase 5
- [x] `git status --ignored` shows `terraform.tfstate`, `.backup`, and lock info as ignored

### Phase 5: Verify and capture evidence

- [x] `terraform output` → all four required outputs present
- [x] Subnets: `describe-subnets` by VPC → 2 public + 2 private across 2 AZs; route tables (public → IGW, private local only)
- [x] Instances: one per public subnet, `running`, `Name` tags equal the tfvars values; public IPs match outputs
- [x] Variable check: `terraform plan -var instance1_name=renamed-1` shows an in-place tag update only and "0 to add, 0 to destroy" (proves names come from variables, no replacement), then discard
- [x] SGs: web SG 80 from `0.0.0.0/0`; db SG 3306 from web SG id only; egress present on web and alb SGs
- [x] RDS: `describe-db-instances --query` → `mysql`, `available`, `PubliclyAccessible=false`, subnet group = the 2 private subnets; endpoint matches output
- [x] ALB: both targets `healthy`; `curl` `alb_url` ~10 times → responses from both instances; `curl` each instance public IP directly
- [x] DB reachability: SSM `send-command` on web1 → TCP connect to `rds_endpoint` (address) on port 3306 succeeds; from workstation it fails
- [x] Fresh-clone check: clone the GitHub repo, `terraform init`, then `terraform plan -state=<orig>/terraform.tfstate` → "No changes." (state is gitignored, so a bare plan would show everything as new)

### Phase 6: Tear down

- [x] Account guard, then `terraform destroy`; confirm `terraform state list` is empty
- [x] Sweep by `Project` tag and by type: instances, DB instances/snapshots/automated backups, LBs/target groups, VPC, RDS-managed secret (force-delete if pending), IAM role/profile
- [x] Log in `hw-terraform-evidence/teardown-log.md`

### Phase 7: Report and submit

- [x] `README.md`: architecture, file/resource map, requirement → resource table, how to run (`init` / `plan` / `apply` / `destroy` with `AWS_PROFILE`), verification commands with outputs, teardown; quote the `terraform output` block captured before destroy (PDF requires the outputs in the report)
- [x] ~~Optional screenshot pass~~ (skipped: Aaron chose destroy now; CLI evidence covers every requirement)
- [x] Scan `apply.log` and other evidence (public repo; account ID and ARNs only, no secrets), then commit evidence logs in `ai-driven-cloud-infrastructure`; bump submodule pointers in kosmos
- [ ] Canvas: repo URL + report (Aaron)

## Progress

- 2026-11-25: Read the assignment PDF and the Terraform lecture (labs pp. 23-53: raw resources, `main.tf` / `variables.tf` / `outputs.tf`, local state, variables with description/type/default, outputs with descriptions). Terraform not installed. Plan written.
- 2026-11-25: **Plan review.** Three independent reviewers (requirements, Terraform/AWS correctness, verification/teardown/process) all returned "proceed after listed changes"; a merged list of 15 changes was unanimously agreed with no amendments and applied. Key fixes: public IPs on public subnets, explicit SG egress, `depends_on` the public routes, sorted t3.micro AZ lookup, SSM AMI + `ignore_changes`, `rds_endpoint` = `.address`, `website.tfplan` + pre-push gate, fresh-clone check via `-state`, account guard on apply/destroy.
- 2026-11-25: **Phases 1-3 written (no AWS yet).** Aaron approved the install; Terraform v1.17.2 from `hashicorp/tap`. Repo `repositories/seis616-terraform-website/` (local git, `main`): `versions.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars`, `user_data.sh`, `.gitignore`, `.terraform.lock.hcl`. `terraform init` installed `hashicorp/aws` v6.74.0; `fmt -check` and `validate` pass; pre-push gate clean. Committed `a96cf4e`. Repo name kept as `seis616-terraform-website`. Blocked on `aaron@gesm4267` session (expired) for `plan` (needs AWS for the AZ/AMI lookups).

- 2026-11-25: **Planned, published, applied.** `terraform plan` → 33 to add (us-east-1a/1b). Created the public repo with `gh repo create` (worked first try); added as kosmos submodule. First apply created 32/33: `db_mysql_from_web` failed with `InvalidParameterValue: Invalid rule description` (apostrophe in "web servers'"). Fixed the description, re-applied (1 added), pushed `0adb83d` before verifying. RDS took 5m17s.
- 2026-11-25: **Verified** (`hw-terraform-evidence/verification-log.md`): all outputs present; 4 subnets 2/2 across 1a/1b, public → IGW, private local-only, 0 NAT; `seis616-web-1` / `seis616-web-2` one per public subnet with public IPs matching outputs; rename plan = 1 in-place change, 0 add/destroy; web SG 80 ← 0.0.0.0/0, db SG 3306 ← web SG only, egress on web + alb; RDS mysql 8.4.11 available, not public, subnet group = both private subnets; both targets healthy, 10 curls hit both instances (4/6), both IPs HTTP 200; SSM from web1 → TCP 3306 open, workstation → unreachable (resolves to 10.0.2.34); fresh clone + `-state` → "No changes."
- 2026-11-25: **Torn down** same session (Aaron chose no screenshots). `terraform destroy` → 33 destroyed, state empty. Sweep clean (`teardown-log.md`); the tagging API briefly still listed terminated instances/volumes, but direct describes returned NotFound. **Report:** README pushed (`aa4bce2`); evidence committed in `ai-driven-cloud-infrastructure` (`15f4dd0`). Remaining: Canvas submission (Aaron).

## Review

All requirements met and verified in 762760349846; nothing left running. Submit `https://github.com/bucky-badger-gesmer/seis616-terraform-website` on Canvas (the README is the report).

Lessons:

- AWS rejects apostrophes in security group rule descriptions (`InvalidParameterValue: Invalid rule description`); `terraform validate` doesn't catch it. Keep descriptions to plain ASCII letters, digits, spaces and `._-:/()#,@[]+=;{}!$*`.
- A failed `terraform apply` still exits 0 when piped through `; echo exit=$?` into a log; grep the log for `Error:` instead of trusting the exit line.
- The three-reviewer pass caught four apply-breaking Terraform defaults (no public IPs on raw subnets, no default SG egress, IGW ordering, `.endpoint` includes the port) before any AWS spend.
- Right after destroy, the Resource Groups Tagging API still lists deleted resources; confirm with direct `describe-*` calls.

## Related

- Assignment: `repositories/ai-driven-cloud-infrastructure/assignments/HW - Terraform.pdf`
- Lecture: `repositories/ai-driven-cloud-infrastructure/lectures/infrastructure-terraform.pdf`
- Project: [[2026-11-19-cdk-website-assignment.project.md]] — same architecture in CDK; reuse its decisions, verification checks, and teardown lessons
- Project: [[2026-09-25-corpweb-cloudformation-assignment.project.md]] — source of the user data and the S3 instance-role fix
