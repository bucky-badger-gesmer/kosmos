---
title: CorpWeb CloudFormation Assignment — SEIS 616
description: SEIS 616 HW — write corpweb.json, a CloudFormation JSON template for a VPC with two public subnets, two Amazon Linux 2023 web servers behind an Application Load Balancer, and a WebUrl output; launch it as WebserversDev in us-east-1, verify via CLI, publish to a public GitHub repo, tear down, and submit a verification report.
status: planning
priority: high
owner: Aaron
created: 2026-09-25
tags:
  [
    aws,
    cloudformation,
    iac,
    json,
    vpc,
    ec2,
    alb,
    security-groups,
    iam,
    assignment,
    seis-616,
  ]
related_projects: [2026-08-13-cloudformation-assignment.project.md]
---

# CorpWeb CloudFormation Assignment — SEIS 616

## Summary

Build `corpweb.json` for the "engineering manager": one CloudFormation **JSON** template that stands up a small load-balanced web tier. Launch it as stack **`WebserversDev`** in **us-east-1**, prove it works from the CLI, commit it to a public GitHub repo, delete the stack, and submit the repo URL plus a verification report on Canvas.

- **Assignment:** `repositories/ai-driven-cloud-infrastructure/assignments/HW - CloudFormation.pdf`
- **AWS account:** **762760349846**, CLI profile `aaron@gesm4267` (always pass `--profile aaron@gesm4267`; the `default` profile is a different account, 908027408892)
- **Submission repo:** `repositories/seis616-corpweb/` → https://github.com/bucky-badger-gesmer/seis616-corpweb (public; must contain **only** `corpweb.json`)
- **Report:** `README.md` in the submission repo (raw evidence logs in `repositories/ai-driven-cloud-infrastructure/assignments/hw-cloudformation-evidence/`)

**Architecture:**

```
Internet
  │  :80
  ▼
EngineeringLB (ALB, internet-facing, SG: WebserversSG)
  │  listener :80 HTTP → target group EngineeringWebservers (:80, health check GET /)
  ├──────────────────────────────┐
  ▼                              ▼
web1 (PublicSubnet1 10.0.0.0/24) web2 (PublicSubnet2 10.0.1.0/24)
  AZ[0]                            AZ[1]
  └────────── EngineeringVpc 10.0.0.0/18 ──────────┘
              public route table: 0.0.0.0/0 → Internet Gateway
WebserversSG: 22 ← YourIp, 80 ← 0.0.0.0/0
```

## Requirements

From the PDF — each maps to a verification check in Phase 4.

- [x] Template file named `corpweb.json` (JSON, not YAML)
- [x] Parameter `InstanceType` — allowed values `t2.micro`, `t2.small` only
- [x] Parameter `KeyPair` — EC2 key-pair name
- [x] Parameter `YourIp` — workstation public IP in CIDR notation
- [x] Output `WebUrl` — the load balancer DNS name
- [x] VPC `EngineeringVpc`, CIDR `10.0.0.0/18`
- [x] Subnets `PublicSubnet1` `10.0.0.0/24` and `PublicSubnet2` `10.0.1.0/24`, both routed to the Internet
- [x] EC2 `web1` (in PublicSubnet1) and `web2` (in PublicSubnet2), with `Name` tags, type from `InstanceType`, Amazon Linux 2023 AMI, key from `KeyPair`
- [x] User data exactly as given (dnf update / install git httpd php / start httpd / `aws s3 cp s3://seis665-public/index.php /var/www/html/`)
- [x] Security group, logical name **and** group name `WebserversSG`, in the VPC: 22 from `YourIp`, 80 from `0.0.0.0/0`
- [x] ALB named `EngineeringLB`; target group named `EngineeringWebservers`; listener 80 → instance port 80 over HTTP; health check HTTP :80 path `/`
- [x] Stack launched as `WebserversDev` in `us-east-1`
- [x] SSH into one instance works; the ALB DNS name in a browser/curl spreads requests across both instances
- [x] Committed `corpweb.json` re-tested **from the GitHub copy** (the PDF's warning box)
- [x] Stack deleted after verification
- [ ] Canvas: GitHub URL + report of how it was verified, with the outputs

## Decisions

Things the PDF leaves open, decided with the default that keeps the spec intact:

| Gap                                                                                                                                                                            | Decision                                                                                                                               | Why                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User data's `aws s3 cp` has no credentials on a bare instance ("Unable to locate credentials" even though `index.php` is public — confirmed readable with `--no-sign-request`) | Add `WebServerRole` + `WebServerInstanceProfile` with an inline policy allowing only `s3:GetObject` on `arn:aws:s3:::seis665-public/*` | Keeps the user data **verbatim**; least privilege. Cost: the stack needs `--capabilities CAPABILITY_IAM` (console: tick the IAM acknowledgement) — note this in the report so the grader can launch it |
| `index.php` reads `http://instance-data/latest/meta-data/instance-id` with a plain IMDSv1 GET; AL2023 instances default to IMDSv2-required, so the page would print a blank ID | `WebServerLaunchTemplate` with `MetadataOptions.HttpTokens: optional`, referenced by both instances                                    | Without it the page can't prove load balancing. **Verify in Phase 4**; if IDs render without it, drop the launch template (simpler)                                                                    |
| AMI must be "Amazon Linux 2023" but no ID given                                                                                                                                | `ImageId` = `{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}}`                                    | Always the current AL2023 x86_64 AMI (t2 is x86); keeps the spec's **exactly three** parameters (an SSM parameter type would add a fourth)                                                             |
| ALB needs 2 AZs                                                                                                                                                                | `PublicSubnet1` → `Fn::Select [0, Fn::GetAZs ""]`, `PublicSubnet2` → index `1`                                                         | Satisfies the ALB rule; us-east-1 AZs 0/1 support t2                                                                                                                                                   |
| SSH needs public IPs                                                                                                                                                           | `MapPublicIpOnLaunch: true` on both subnets                                                                                            | Subnets are public per spec                                                                                                                                                                            |
| ALB security group                                                                                                                                                             | Reuse `WebserversSG`                                                                                                                   | Already allows 80 from anywhere; no extra resource                                                                                                                                                     |
| `chkconfig` isn't on AL2023                                                                                                                                                    | Leave it                                                                                                                               | Required user data; the line errors but the script continues, httpd already started                                                                                                                    |
| Linting                                                                                                                                                                        | `aws cloudformation validate-template` + a real deploy; no `cfn-lint`                                                                  | Not required; no new tooling installed                                                                                                                                                                 |

**Key pair:** register `~/.ssh/lab-key.pem`'s public key as `lab-key` in the target account if no usable key pair exists there. (`EC2 Tutorial` in 908027408892 had no matching local `.pem`.)

## Implementation Plan

### Phase 1: Author `corpweb.json`

In `repositories/seis616-corpweb/`. Logical IDs in dependency order:

- [x] `Parameters`: `InstanceType` (String, `AllowedValues`, default `t2.micro`), `KeyPair` (`AWS::EC2::KeyPair::KeyName`), `YourIp` (String, CIDR `AllowedPattern`)
- [x] Network: `EngineeringVpc` → `InternetGateway` → `VpcGatewayAttachment` → `PublicSubnet1`, `PublicSubnet2` → `PublicRouteTable` → `PublicRoute` (`DependsOn: VpcGatewayAttachment`) → two `SubnetRouteTableAssociation`s
- [x] `WebserversSG` (`GroupName: WebserversSG`, `VpcId: EngineeringVpc`, two ingress rules)
- [x] `WebServerRole` + `WebServerInstanceProfile`
- [x] `WebServerLaunchTemplate` (IMDS `HttpTokens: optional`)
- [x] `web1`, `web2`: `InstanceType`/`KeyName` refs, SSM-resolved `ImageId`, `SubnetId`, `SecurityGroupIds`, `IamInstanceProfile`, `LaunchTemplate`, `Tags: Name=web1|web2`, `UserData` via `Fn::Base64` of the exact script
- [x] `EngineeringWebservers` target group: `Name`, `Port 80`, `Protocol HTTP`, `VpcId`, `HealthCheckProtocol HTTP`, `HealthCheckPort 80`, `HealthCheckPath /`, `Targets` web1 + web2
- [x] `EngineeringLB`: `Name`, `Type application`, `Scheme internet-facing`, both subnets, `WebserversSG`
- [x] `EngineeringLBListener`: port 80 HTTP → forward to `EngineeringWebservers`
- [x] `Outputs.WebUrl`: `Fn::GetAtt [EngineeringLB, DNSName]`
- [x] Format with 2-space JSON, LF, no trailing edits by other tools

### Phase 2: Validate locally

- [x] `python3 -m json.tool corpweb.json > /dev/null` (pure JSON syntax)
- [x] `aws cloudformation validate-template --template-body file://corpweb.json --region us-east-1` (should list 3 parameters + `CAPABILITY_IAM`)
- [x] Check logical IDs / names against the Requirements list

### Phase 3: Publish, then deploy from the published copy

Deploying the GitHub copy from the start satisfies the PDF's warning without a second full test run.

- [x] Commit `corpweb.json` in `seis616-corpweb` (`feat: add corpweb CloudFormation template`), push
- [x] Download `https://raw.githubusercontent.com/bucky-badger-gesmer/seis616-corpweb/main/corpweb.json`; `cmp` against local (must be identical)
- [x] Create/confirm key pair
- [x] `aws cloudformation create-stack --stack-name WebserversDev --region us-east-1 --template-body file://<downloaded copy> --capabilities CAPABILITY_IAM --parameters InstanceType=t2.micro KeyPair=<key> YourIp=<curl checkip>/32`
- [x] `aws cloudformation wait stack-create-complete`; on failure: `describe-stack-events` → fix → commit/push → delete stack → redeploy from the new raw copy. Log each failure + fix in Progress (useful report material)

### Phase 4: Verify and capture evidence

Save every command + output to the report (`hw-cloudformation-report.md`).

- [x] `describe-stacks` — `CREATE_COMPLETE`, parameters, `WebUrl` output
- [x] `describe-stack-resources` — every logical ID from the spec present
- [x] `ec2 describe-instances` — web1/web2 Name tags, instance type, subnet, AL2023 AMI, key name, `running`
- [x] `ec2 describe-security-groups --group-names WebserversSG` — 22 ← YourIp, 80 ← 0.0.0.0/0
- [x] `ec2 describe-vpcs` / `describe-subnets` / `describe-route-tables` — CIDRs + 0.0.0.0/0 → IGW
- [x] `elbv2 describe-load-balancers` / `describe-target-groups` / `describe-listeners` / `describe-target-health` — names, 80→80 HTTP, health check `/`, both targets `healthy`
- [x] SSH: `ssh -i <key>.pem ec2-user@<web1 public IP>` → `hostname; systemctl is-active httpd; ls /var/www/html`
- [x] Load balancing: `for i in $(seq 10); do curl -s http://<WebUrl>/index.php; done` — both instance IDs appear (confirm the IMDS decision here)
- [x] Browser check of the WebUrl (optional; refresh shows alternating IDs) — confirmed by Aaron

### Phase 5: Tear down

- [x] `aws cloudformation delete-stack --stack-name WebserversDev` + `wait stack-delete-complete`
- [x] Confirm: stack gone, instances `terminated`, no `EngineeringLB`, `EngineeringVpc` deleted — capture output for the report
- [x] Keep the `lab-key` key pair in 762760349846 (free; handy for later labs)

### Phase 6: Report and submit

- [x] Report written as the submission repo's `README.md` (template overview, requirement → resource table, design decisions, 11-step verification with command outputs, teardown). Public IP masked as `x.x.x.x`
- [x] ~~Export to PDF/DOCX~~ not needed (report lives in the repo README)
- [ ] Canvas: submit `https://github.com/bucky-badger-gesmer/seis616-corpweb` + report
- [ ] Commit report in `ai-driven-cloud-infrastructure`; bump submodule pointers in kosmos

## Progress

- 2026-09-25: Read the assignment PDF. Pre-checks: AWS CLI authenticated (account 908027408892); us-east-1 key pairs: `EC2 Tutorial`; no `WebserversDev` stack exists; `s3://seis665-public/index.php` readable without signing (it echoes the instance ID via IMDSv1).
- 2026-09-25: Created public repo `bucky-badger-gesmer/seis616-corpweb` (empty init commit) and registered it as kosmos submodule `repositories/seis616-corpweb` (`8c532ab`).
- 2026-09-25: Project plan written.
- 2026-09-25: **Phase 1 done** — wrote `repositories/seis616-corpweb/corpweb.json` (18 resources, 3 parameters, `WebUrl` output). Confirmed `seis665-public` is a us-east-1 bucket (200 on the global endpoint, no redirect), so the user data's region-less `aws s3 cp` is fine.
- 2026-09-25: **Phase 2 done** — `json.tool` OK; `validate-template` OK (3 parameters, requires `CAPABILITY_IAM` for `WebServerRole`); decoded user data matches the PDF line for line on both instances; the SSM AL2023 lookup currently resolves to `ami-0fef201115eefe936`.
- 2026-09-25: **Phase 3 done** — committed + pushed `corpweb.json` (`44222fe`; repo tracks only that file). GitHub copy downloaded and `cmp`-identical to local (SHA-256 `f45631bd…45f1`). Launched `WebserversDev` in us-east-1 **from the GitHub copy** (`InstanceType=t2.micro`, `KeyPair=EC2 Tutorial`, `YourIp=x.x.x.x/32`, `CAPABILITY_IAM`) at 19:21:56 UTC → `CREATE_COMPLETE` on the first attempt, all 18 resources, no failed events. `WebUrl` = `EngineeringLB-897445617.us-east-1.elb.amazonaws.com`. Stack status + full event log saved to the session scratchpad for the report. **Stack is live and billing until Phase 5.**
- 2026-09-25: **Phase 4 CLI checks done** — log at `repositories/ai-driven-cloud-infrastructure/assignments/hw-cloudformation-evidence/verification-log.md` (+ `stack-events.json`). All 18 resources `CREATE_COMPLETE`; VPC `10.0.0.0/18`; subnets `10.0.0.0/24` (us-east-1a) / `10.0.1.0/24` (us-east-1b), both → IGW; web1 `i-0176111e2bb8b7bcc` / web2 `i-0142a91a52a859a79`, t2.micro, `al2023-ami-2023.12.20260918.0-kernel-6.18-x86_64`, key `EC2 Tutorial`; `WebserversSG` 22 ← `x.x.x.x/32`, 80 ← `0.0.0.0/0`; ALB active in 2 AZs, listener 80 HTTP → `EngineeringWebservers` (HTTP 80, health check `/`), both targets healthy; `GET /` → 200 (Apache 2.4.68, PHP 8.5.10); 20 requests split **10 / 10** across the two instances. SSH still pending.
- 2026-09-25: **Wrong account — reset.** The Phase 3/4 deploy and verification above ran in **908027408892** (the CLI `default` profile), not the intended personal account **762760349846** (profile `aaron@gesm4267`). SSH also failed there: neither `~/.ssh/lab-key.pem` nor `summer-2026.pem` matches `EC2 Tutorial`. Deleted `WebserversDev` from 908027408892 (`DELETE_COMPLETE`; instances terminated, `EngineeringLB`, `EngineeringVpc`, and IAM role confirmed gone) and discarded that evidence. `corpweb.json` / GitHub (`44222fe`) unaffected. Redo Phase 3 (from key pair) + Phase 4 in 762760349846.
- 2026-09-25: **Phase 3 redone in 762760349846** — confirmed `aaron@gesm4267` = 762760349846 (IAM user `aaron`); account had no key pairs, so imported `~/.ssh/lab-key.pem`'s public key as `lab-key` (fingerprint `33:c2:30:d0:78:22:5f:52:19:67:a6:e5:c6:e4:12:9d`). Re-downloaded the GitHub copy (still SHA-256 `f45631bd…45f1`, `cmp`-identical) and launched `WebserversDev` from it at 19:46:03 UTC (`t2.micro`, `lab-key`, `x.x.x.x/32`, `CAPABILITY_IAM`) → `CREATE_COMPLETE`, no failed events. `WebUrl` = `EngineeringLB-1369476053.us-east-1.elb.amazonaws.com`.
- 2026-09-25: **Phase 4 done in 762760349846** — log at `repositories/ai-driven-cloud-infrastructure/assignments/hw-cloudformation-evidence/verification-log.md` (+ `stack-events.json`). All 18 resources `CREATE_COMPLETE`; VPC/subnets/route/SG/ALB/listener/target group exactly per spec; web1 `i-0ae4ac42201d170fc` (us-east-1a, 3.235.150.34) / web2 `i-06563224368a9fe7b` (us-east-1b, 44.211.147.153), t2.micro, AL2023, key `lab-key`; both targets healthy; `GET /` 200; 20 requests split **11 / 9**. **SSH with `lab-key.pem` succeeded on both instances** — `httpd` active, `index.php` present (proves the S3 role worked), local page shows each instance's own ID. Only the optional browser screenshot remains. **Stack live and billing until Phase 5.**
- 2026-09-25: Browser check of the WebUrl confirmed working by Aaron.
- 2026-09-25: **Phase 5 done** — deleted `WebserversDev` from 762760349846 at 19:52:24 UTC → `DELETE_COMPLETE` (~1.5 min). Confirmed gone: stack, both instances `terminated`, `EngineeringLB`, `EngineeringWebservers`, `EngineeringVpc`, `WebserversSG`, IAM role; WebUrl no longer resolves (curl exit 6). Log: `hw-cloudformation-evidence/teardown-log.md`. `lab-key` key pair kept (no cost). **Nothing billable left from this assignment in either account.**
- 2026-09-25: **Report published** — `README.md` committed + pushed to `seis616-corpweb` (`46d0827`); repo is public and contains `README.md` + `corpweb.json`; `corpweb.json` on GitHub still SHA-256 `f45631bd…45f1` (the tested file). Public IP masked as `x.x.x.x` in README, evidence logs, and this file. Evidence logs committed in `ai-driven-cloud-infrastructure` (`9167178`, not yet pushed). Post-teardown sweep: all 17 regions in both 762760349846 and 908027408892 have no EC2 instances, load balancers, NAT gateways, EIPs, EBS volumes, or live stacks. Remaining: Canvas submission.

## Review

{{Document results, lessons learned, and outcomes}}

## Related

- Assignment: `repositories/ai-driven-cloud-infrastructure/assignments/HW - CloudFormation.pdf`
- Lecture: `repositories/ai-driven-cloud-infrastructure/lectures/infrastructure-IaC Practices with AWS CF.pdf`
- Project: [[2026-08-13-cloudformation-assignment.project.md]] — SEIS 615 CloudFormation assignment; same VPC/SG/SSM-AMI patterns, runbook style
