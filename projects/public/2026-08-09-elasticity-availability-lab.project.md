---
title: Elasticity & Availability Lab — Assignment Walkthrough
description: >
  Class assignment deliverables for making the café infrastructure highly scalable and reliable — step-by-step console walkthrough following the professor's demonstrated method: "VPC and more" wizard (2 AZ, 6 subnets, zonal NATs), stock Amazon Linux AMI bootstrapped by a user-data script pulling from S3 via an EC2 IAM role, launch template, Auto Scaling group, ALB, Multi-AZ RDS, and a bastion + stress load test; the Canvas report is handled separately by Aaron
status: active
priority: high
owner: Aaron
created: 2026-08-09
tags:
  [
    aws,
    ec2,
    auto-scaling,
    launch-template,
    user-data,
    iam-role,
    s3-bootstrap,
    alb,
    load-balancer,
    nat-gateway,
    bastion,
    elasticity,
    availability,
    high-availability,
    assignment,
  ]
related_projects:
  [
    2026-08-05-rds-multiaz-read-replica-assignment.project.md,
    2026-07-31-aws-vpc-lab.memory.md,
  ]
---

# Elasticity & Availability Lab — Assignment Walkthrough

## Summary

Extends the previous café application assignment by making the infrastructure **highly scalable and reliable**. The deliverable is the architecture in the assignment diagram: a 2-AZ VPC with public subnets (ALB + NAT gateways) and private subnets (Auto Scaling group of webservers + Multi-AZ RDS), built via launch template, ASG, and load balancer, then verified with a real load test. **The walkthrough below is the deliverable; the Canvas report is handled by Aaron** (per assignment: step-by-step instructions + citations).

**Method = the professor's demonstration, followed throughout:** the VPC is built with the **"VPC and more" wizard** (not resource-by-resource); there is **no golden AMI** — instances launch from the **stock Amazon Linux 2023 AMI** and a **user-data script** installs httpd/php and copies the site from **`s3://seis665-public`** at first boot, signed by an **EC2 IAM role with S3 full access**; the scaling test uses a **bastion host + `stress`** on the private webservers (Apache Benchmark noted as the sanctioned alternative). The web app served is therefore the class's `index.php` page — the report should cite the professor's demo script as the source and note this is the demonstrated bootstrap payload.

Scope: write-up first, then hands-on run. Console walkthrough in **us-east-1**. Prerequisite VPC resources are **free**; runtime resources (2 NAT gateways ≈ $65/mo, ALB ≈ $17/mo, 2–4 `t2.micro` webservers ≈ $17–34/mo, 1 `t2.micro` bastion ≈ $8.50/mo, Multi-AZ RDS ≈ $38/mo) accrue hourly — stop/delete after the lab (see Teardown).

## Requirements

- [x] **Infrastructure as depicted:** VPC `10.0.0.0/16`, 2 public subnets (with NAT gateways), 4 private subnets (2 app + 2 DB), IGW, ALB, Multi-AZ RDS — built with the **"VPC and more" wizard** as demonstrated _(live 2026-08-11, CLI replica)_
- [x] **App bootstrap (professor's method):** stock Amazon Linux 2023 AMI + **user-data script** (`dnf install httpd php` → start httpd → `aws s3 cp s3://seis665-public/index.php /var/www/html/`) — no custom AMI build _(live; served page verified)_
- [x] **IAM role:** EC2 service role with **AmazonS3FullAccess** (as demonstrated) attached as the instance profile — the `aws s3 cp` in user data signs with these credentials _(live: `webserver-role`)_
- [x] **Launch template:** stock AL2023 AMI, `t2.micro`, key pair, app security group, IAM instance profile, user-data script _(live: `webserver-lt`, v2 adds `HttpTokens=optional` for the IMDSv1 metadata read)_
- [x] **Auto Scaling group:** spans both app subnets (2 AZs), min 2 / desired 2 / max 4, attached to the ALB target group, CPU target-tracking policy _(live: `webserver-asg`, `cpu-target-60` @ 60 %)_
- [x] **Load balancer:** internet-facing ALB in both public subnets, listener → target group → ASG instances (professor's name `webserver_elb` → use `webserver-elb`; ELB names reject underscores) _(live: `webserver-elb`)_
- [x] **Test the web app:** reachable via the ALB DNS name _(live: HTTP 200, alternates across instances)_
- [x] **Test automatic scaling under load:** bastion → SSH to private webservers → `stress --cpu 1 --timeout 600s` → scale-out → load ends → scale-in (Apache Benchmark = alternative) _(live 2026-08-11: 2 → 4 → 2, alarm + activity verified)_
- [ ] **Report for Canvas — step-by-step instructions + citations** _(Aaron, separate; cite the professor's demo script and AWS docs)_

## Walkthrough — Setup in AWS

> The deliverable: console steps to build the assignment architecture in **us-east-1**, the professor's way. Follow the phases in order. Everything is created from scratch (no class-lab assumption).

### Architecture recap (from the assignment diagram)

```
Internet
 ├── Internet Gateway
 └── ALB (Web-application-tier load balancer) — public subnets 1 & 2
       └── target group → Auto Scaling group of webservers (private subnets 1 & 2)
             └── RDS: Primary (private subnet 3) + Multi-AZ standby (private subnet 4)
Public subnets each hold a NAT gateway → outbound internet for the private app subnets
VPC 10.0.0.0/16 · AZ A (subnets .0/.2/.4) · AZ B (subnets .1/.3/.5)
```

### Phase 1 — VPC via the "VPC and more" wizard

> One screen replaces the entire manual build: the wizard creates and wires the VPC, subnets, IGW, EIPs, NAT gateways, route tables, and associations in a single operation, with a live preview diagram on the right. This is exactly what the professor demonstrated.

VPC → **Your VPCs** → **Create VPC** → select **`VPC and more`** (not `VPC only`):

| Field                        | Value                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Name tag auto-generation     | ✅ **Auto-generate** checked, base name: `elast` (names everything `elast-vpc`, `elast-subnet-public1-us-east-1a`, `elast-rtb-…`, etc.) |
| IPv4 CIDR block              | `10.0.0.0/16`                                                                                                                           |
| IPv6 CIDR block              | No IPv6                                                                                                                                 |
| Tenancy                      | Default                                                                                                                                 |
| Number of Availability Zones | **2** (expand **Customize AZs**: `us-east-1a`, `us-east-1b`)                                                                            |
| Number of public subnets     | **2**                                                                                                                                   |
| Number of private subnets    | **4** ← the demo showed 2, but the assignment diagram needs 4 (2 app + 2 DB); same screen, just pick 4                                  |
| NAT gateways ($)             | **1 per AZ** ← the zonal one-NAT-per-public-subnet layout from the diagram (wizard allocates the EIPs itself)                           |
| VPC endpoints                | **None** ← the default is "S3 Gateway" — change it; professor: no VPC endpoints                                                         |
| DNS options                  | ✅ Enable DNS hostnames **and** ✅ Enable DNS resolution (both checked)                                                                 |

**Customize subnets CIDR blocks** (expand it — wizard defaults are `/20`s; the professor changed them to `/24`, matching the diagram exactly):

| Wizard subnet | CIDR          | AZ           | Diagram role    |
| ------------- | ------------- | ------------ | --------------- |
| public1       | `10.0.0.0/24` | `us-east-1a` | Public subnet 1 |
| public2       | `10.0.1.0/24` | `us-east-1b` | Public subnet 2 |
| private1      | `10.0.2.0/24` | `us-east-1a` | Private 1 (app) |
| private2      | `10.0.3.0/24` | `us-east-1b` | Private 2 (app) |
| private3      | `10.0.4.0/24` | `us-east-1a` | Private 3 (DB)  |
| private4      | `10.0.5.0/24` | `us-east-1b` | Private 4 (DB)  |

→ **Create VPC** — a progress screen lists every resource as it's created (~2–3 min; the NAT gateways are the slow part).

**What the wizard wired for you** (this replaces every manual route-table step): IGW attached; one public route table (`0.0.0.0/0` → IGW, both public subnets associated); one route table **per private subnet**, each with `0.0.0.0/0` → its **own AZ's NAT gateway**. Note the DB subnets get NAT routes too — the manual plan kept them local-only, but this is the wizard/demo behavior and is harmless (RDS simply never uses the route).

**✅ Phase 1 completion checklist** — all must be true before Phase 2:

- [ ] `elast-vpc` **Available**, DNS hostnames + DNS resolution both **Enabled** (VPC → details tab)
- [ ] 6 subnets exist with the `/24` CIDRs/AZs above (VPC → Subnets → filter by `elast`)
- [ ] IGW attached to `elast-vpc`
- [ ] 2 NAT gateways **Available**, one per public subnet, each with its EIP
- [ ] Route tables: public RT → IGW; each private RT → its AZ's NAT gateway (Routes + Subnet associations tabs)

> A resource-by-resource manual build (validated live 2026-08-10) produces the identical topology — kept as the fallback path in [[2026-07-31-aws-vpc-lab.memory.md]]; the wizard is what the professor demonstrated and what the report documents.

### Phase 2 — IAM role + user-data script (replaces the golden-AMI build)

> **No custom AMI in this variant.** Instances launch from the stock Amazon Linux 2023 AMI, and the launch template's user-data script assembles the app at each instance's first boot: install httpd/php, start the service, copy the site from S3. The `aws s3 cp` signs its request with the **instance profile's** credentials — role, script, and bucket are three parts of one mechanism. No role → copy fails → empty webserver → health checks fail.

**1. IAM role** — IAM → **Roles** → **Create role**:

- Trusted entity type: `AWS service` | Use case: **EC2** → **Next**.
- Permissions: search and check **`AmazonS3FullAccess`** (as demonstrated; `AmazonS3ReadOnlyAccess` would be the least-privilege alternative — worth a sentence in the report) → **Next**.
- Role name: `webserver-role` → **Create role**. (The console creates the matching instance profile automatically — that's the name selected in the launch template.)
- ⚠️ **AWS Academy Learner Lab:** role creation is blocked in those accounts — skip the steps above and select the pre-made **`LabInstanceProfile`** in the template instead.

**2. User-data script** — the professor's script, verbatim:

```bash
#!/bin/bash
dnf update -y
dnf install -y git httpd php
service httpd start
chkconfig httpd on
aws s3 cp s3://seis665-public/index.php /var/www/html/
```

- ⚠️ **AL2023 compatibility:** `service` and `chkconfig` are legacy SysV commands that Amazon Linux **2023** no longer ships — on AL2023 those two lines fail silently and httpd never starts. Use the systemd equivalent (one line replaces both):

```bash
#!/bin/bash
dnf update -y
dnf install -y git httpd php
systemctl enable --now httpd
aws s3 cp s3://seis665-public/index.php /var/www/html/
```

- Keep the professor's original two lines only if launching an Amazon Linux **2** AMI. The report should show his script as the cited source and the systemd fix as the adaptation.
- The `s3 cp` needs an **outbound path**: the app subnets' NAT routes (Phase 1) provide it. Private instance + no NAT route = the copy hangs and the instance comes up blank.
- Installing `php` makes Apache serve `index.php` as the directory index, so `http://…/` returns the page — this is what makes the ALB health check on `/` pass ("health check with the user-data script").

### Phase 3 — Security groups (EC2 → **Security groups** → **Create security group**)

| Group              | VPC         | Inbound rules                                                                                                                                                  |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elast-alb-sg`     | `elast-vpc` | HTTP `80` from `0.0.0.0/0` (the professor's demo rule: HTTP, source anywhere)                                                                                  |
| `elast-app-sg`     | `elast-vpc` | HTTP `80` from **Security group** `elast-alb-sg` (only the ALB can reach the app); SSH `22` from **Security group** `elast-bastion-sg` (the Phase 9 jump path) |
| `elast-bastion-sg` | `elast-vpc` | SSH `22` from **your IP `/32`** only                                                                                                                           |
| `elast-db-sg`      | `elast-vpc` | MySQL/Aurora `3306` from **Security group** `elast-app-sg`                                                                                                     |

- **Outbound:** leave every group's default outbound rule (allow all) untouched — the professor's "no need for outbound" means exactly this; the user-data `s3 cp` and `dnf` depend on it.
- The demo used a single HTTP-from-anywhere group; this layered chain is a strict superset (same reachability from the internet, tighter inside). The report can note the layering as standard practice.

### Phase 4 — Multi-AZ RDS (primary in private subnet 3, standby in private subnet 4)

> Not covered in the demo notes, but required by the assignment diagram — this is the piece carried over from the previous (RDS Multi-AZ) assignment.

1. RDS → **Databases** → **Create database** → Standard create → engine from the previous assignment (MySQL/MariaDB).
2. **Templates:** `Production` | **Availability & durability:** **Multi-AZ DB instance**.
3. **Settings:** identifier `elast-db-prod` | Instance class `db.t3.micro` (or the class used before) | Master username/password as before.
4. **Connectivity:** VPC `elast-vpc` | **DB subnet group:** create one — name `elast-db-subnet-group`, add the two DB subnets (`10.0.4.0/24` + `10.0.5.0/24`) | Public access: **No** | VPC security group: `elast-db-sg`.
5. **Storage — fix the Production defaults** (they jump the estimate to ~$700/mo): **gp3** / **20 GiB** / **3000 IOPS**, storage autoscaling off.
6. **Create database** → wait for `Available` (5–10 min). Full Multi-AZ verify/failover steps: see [[2026-08-05-rds-multiaz-read-replica-assignment.project.md]] Tutorial 1 (same procedure, this VPC).
   - No VPC endpoints in this build (professor: none) — RDS backups traverse the AWS-managed side and need no route or endpoint in the VPC.
   - The demo `index.php` doesn't read the DB — the database exists to satisfy the architecture; nothing to seed or wire. Only the SG chain matters (`elast-db-sg` ← `elast-app-sg` ← `elast-alb-sg`).

### Phase 5 — Launch template

EC2 → **Launch Templates** → **Create launch template**:

| Field                                     | Value                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Launch template name                      | `webserver-lt`                                                                                                                                   |
| Application and OS Images                 | **Quick Start** → **Amazon Linux 2023** (stock, Free tier eligible — no custom AMI)                                                              |
| Instance type                             | `t2.micro`                                                                                                                                       |
| Key pair                                  | your existing key pair (e.g. `summer-2026`) — needed for the Phase 9 bastion jump                                                                |
| Network settings → Security groups        | `elast-app-sg`                                                                                                                                   |
| Advanced → IAM instance profile           | `webserver-role` (or `LabInstanceProfile` in Learner Lab)                                                                                        |
| Advanced → Detailed CloudWatch monitoring | **Enable** (needed for fast scaling metrics)                                                                                                     |
| Advanced → User data                      | the **AL2023-fixed bootstrap script** from Phase 2 — this is what puts the app on every instance; without it the target group never goes healthy |

- **Do not** pick a subnet in the template — the ASG chooses the AZ per instance.
- Click **Create launch template** → the **"Launch instance from this template"** page that follows is _optional_ — close it; the ASG launches the instances.

### Phase 6 — Load balancer (ALB + target group)

**1. Target group first** (EC2 → **Target Groups** → **Create target group**):

- Target type: `Instances` | Name: `webserver-tg` | Protocol: `HTTP` : `80` | VPC: `elast-vpc`.
- Health checks: protocol `HTTP`, path `/` (served by the user-data-deployed `index.php`; `/index.php` works too and is more explicit), healthy threshold `2`, unhealthy threshold `5`, interval `30` (lower to `10` during the load test for faster reaction), timeout `5`.
- **Register targets: none** — the ASG registers and deregisters instances automatically. Create the group with the empty pool.

**2. ALB** (EC2 → **Load Balancers** → **Create load balancer** → **Application Load Balancer**):

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Name            | `webserver-elb` (professor wrote `webserver_elb`; the console rejects underscores in ELB names) |
| Scheme          | **Internet-facing**                                                                             |
| IP address type | `IPv4`                                                                                          |
| VPC             | `elast-vpc`                                                                                     |
| Mappings        | check **both AZs** → `us-east-1a` → public subnet 1, `us-east-1b` → public subnet 2             |
| Security groups | `elast-alb-sg`                                                                                  |
| Listener        | HTTP `80` → forward to `webserver-tg`                                                           |

→ **Create load balancer**, wait for state `active` (2–5 min). Note the **DNS name** (`webserver-elb-<id>.us-east-1.elb.amazonaws.com`) — this is the app's public URL.

### Phase 7 — Auto Scaling group

EC2 → **Auto Scaling Groups** → **Create Auto Scaling group**:

1. **Launch template:** `webserver-lt` → **Next**.
2. **Instance launch options:** Name `webserver-asg` | VPC `elast-vpc` | **Availability Zones and subnets:** private subnets 1 + 2 (the app subnets, `10.0.2.0/24` + `10.0.3.0/24` — private is correct; instances get no public IP, the ALB fronts them) → **Next**.
3. **Attach to an existing load balancer:** target groups → select `webserver-tg`. **Health checks:** tick **Elastic Load Balancing health checks** (keep EC2 health checks on too) → **Next**.
4. **Group size:** Desired `2` | Minimum `2` | Maximum `4` (assignment wants ≥2 for high availability; 4 gives headroom for the scale test).
5. **Scaling policies — select "Target tracking"** (simplest, self-tuning):
   - Policy: Average **EC2 CPU utilization**, target value `60`, instances needed `2`. This creates its own CloudWatch alarm automatically.
   - ⚠️ Target tracking needs **detailed CloudWatch monitoring** (enabled in the launch template) and a ~60 s **stabilization period** before it scales — don't expect instant reaction in the test.
   - ⚠️ The metric is the **group average** — see the Phase 9 math note before running the stress test.
6. **Instance maintenance / Additional settings:** defaults are fine; **Termination policy** default, **Scale-in protection: off** (the ASG must be able to shrink the group in the demo).
7. **Create Auto Scaling group** → **Instances** tab: two instances launch (one per AZ). First boot runs the user-data script (~2–3 min including `dnf update`), then both pass health checks and register into `webserver-tg`. If a target stays `unhealthy`, the bootstrap failed — check the role is attached and the app subnets route to NAT.

### Phase 8 — Test the web application

1. EC2 → **Load Balancers** → `webserver-elb` → copy the **DNS name**.
2. Browser: `http://<alb-dns-name>/` → the `index.php` page deployed by user data loads. ⚠️ The ALB DNS name is the **only** public path to the app — instances are private and have no public IPs. Refresh a few times: requests alternate across both instances.
3. EC2 → **Target Groups** → `webserver-tg` → **Targets** tab → both instances show **healthy**.
4. **Resilience check:** EC2 → **Instances** → select one ASG instance → **Instance state** → **Terminate** → watch the ASG launch a replacement automatically (EC2 → Auto Scaling Groups → `webserver-asg` → **Activity** tab). The replacement bootstraps itself from the same user-data script — this is the whole point of the professor's approach: the app is reproducible from the template alone. The site stays up throughout (the ALB keeps routing to the healthy instance).

### Phase 9 — Test automatic scaling under load (bastion + stress, as demonstrated)

**1. Set up the bastion host** (the jump point into the private subnets):

- EC2 → **Launch instances** → name `bastion` | AMI: Amazon Linux 2023 | type `t2.micro` | key pair: **the same key pair as the launch template** | Network: VPC `elast-vpc`, subnet **public subnet 1**, Auto-assign public IP **Enable** | SG: `elast-bastion-sg` → **Launch instance**. Note its public IP.

**2. Jump to a webserver** with SSH agent forwarding (never copy the `.pem` onto the bastion):

```bash
ssh-add ~/.ssh/<key>.pem
ssh -A ec2-user@<bastion-public-ip>
# now on the bastion — get the webservers' private IPs from EC2 → Instances first
ssh ec2-user@<webserver-private-ip>
```

**3. Stress the CPU** (professor's commands, verbatim):

```bash
sudo dnf install stress -y
stress --cpu 1 --timeout 600s
```

`--cpu 1` pegs the `t2.micro`'s single vCPU at 100% for 600 s.

- ⚠️ **Group-average math:** target tracking scales on the **average** CPU across the group. With 2 instances, one at 100% and one idle averages ~50% — **below the 60% target, so nothing scales.** Open a second terminal, jump to the **other** webserver via the bastion, and run `stress` there too (average → ~100%, alarm fires). Alternative: set the target value to `50` in Phase 7 and one stressed instance suffices.

**4. Watch scale-out live:** EC2 → **Auto Scaling Groups** → `webserver-asg` → **Activity** tab: `Launching a new EC2 instance` entries appear (allow the ~60 s stabilization + a couple of alarm periods). **Instances** tab grows toward the max of 4. CloudWatch → **Alarms** shows the target-tracking CPU alarm `In alarm`. New instances bootstrap from user data and register into the target group automatically.

**5. Scale-in:** when the 600 s timers expire (or Ctrl-C the `stress` runs), CPU falls, and after the scale-in evaluation window (~15 min of low CPU — be patient) the **Activity** tab shows `Terminating EC2 instances` until the group is back at desired `2`. It never drops below minimum `2`.

**6. Verify:** the site stays reachable through the ALB for the entire test — no downtime, elastic both ways. Screenshot the Activity tab and the CloudWatch alarm for the report.

**Alternative (sanctioned in the handout): Apache Benchmark** — generate real HTTP traffic instead of stressing CPUs directly; the ALB spreads it across all instances (no average-CPU caveat) and the load balancer itself gets exercised:

```bash
# from the bastion (or any machine with internet access)
sudo dnf install -y httpd-tools
ab -n 200000 -c 100 http://<alb-dns-name>/
```

## Teardown (after the lab)

1. EC2 → **Auto Scaling Groups** → `webserver-asg` → **Delete** → confirm (delete `webserver-lt` too if prompted). EC2 → **Instances** → terminate `bastion`.
2. EC2 → **Load Balancers** → delete `webserver-elb` → then **Target Groups** → delete `webserver-tg` (ALB must go first).
3. RDS → **Databases** → delete `elast-db-prod` → untick final snapshot → confirm (deletion protection off — if blocked, **Modify → Deletion protection: untick → Apply immediately**).
4. VPC → **NAT gateways** → select both wizard-created NATs → **Actions** → **Delete NAT gateway** (billing stops immediately). EC2 → **Elastic IPs** → select both wizard-allocated EIPs → **Actions** → **Release** (⚠️ EIPs bill ~$3.60/mo each while unassociated).
5. IAM hygiene (free, but should go): IAM → **Roles** → delete `webserver-role` (skip if using the pre-made `LabInstanceProfile` — that one isn't yours to delete).
6. Security groups → delete `elast-db-sg`, `elast-app-sg`, `elast-bastion-sg`, `elast-alb-sg` (in that order — SGs referenced by others fail until the referrer is gone).
7. VPC → **Your VPCs** → select `elast-vpc` → **Delete VPC** — the console deletes the wizard-created subnets, route tables, and IGW along with it (it lists everything it will remove; NATs and the RDS subnet group must already be gone or the delete is blocked).

_No AMI or snapshot cleanup in this variant — nothing was baked._

## Progress

- 2026-08-09: Project created from the assignment PDF (3 pages: extension brief, target architecture diagram, deliverables). Walkthrough drafted in phases 1–9 (VPC/IGW/NAT → AMI → SGs → RDS → launch template → ALB → ASG → app test → load test), matching the diagram's CIDR layout exactly; report marked as Aaron's part.
- 2026-08-10: Phase 2 rewritten as a **from-scratch AMI build** — the previous assignment's café instance AND its AMI were deleted per teardown instructions, so the golden image was to be rebuilt from the class's `static-website` source. _(Superseded 2026-08-11 — see below.)_
- 2026-08-10: Phase 1 validated live against account 762760349846 as a **manual resource-by-resource build** — all checklist items green (VPC, DNS hostnames, 6 subnets, IGW, 2 NATs + EIPs, 3 RTs with routes + associations). _(Superseded by the wizard build 2026-08-11; the manual path produces the identical topology and remains the documented fallback.)_
- 2026-08-11: IAM instance profile added to Phase 5 (`cafe-app-role` with SSM). _(Superseded same day — role is now `webserver-role` with S3 access, per the demo.)_
- 2026-08-11: **Full teardown executed** — all assignment resources deleted from us-east-1: ASG `webserver-asg` (force, terminated both webservers) + bastion `i-09f7270e3f084f6f9`, ALB `webserver-elb` (its 2 per-AZ EIPs auto-released) + TG `webserver-tg`, RDS `elast-db-prod` (no final snapshot, automated backups deleted) + `elast-db-subnet-group`, NATs `elast-natgateway-a/b` + EIPs `elast-eip-a/b` (released, ~$7/mo stopped), LT `webserver-lt`, IAM role/profile `webserver-role`, SGs (db → app → bastion → alb), 6 subnets, IGW `elast-igw`, 5 non-main RTs (CLI requires these before VPC delete — the console cascades them), VPC `elast-vpc`. Target-tracking alarms auto-deleted with the ASG. Final sweep green: only the pre-existing default VPC `vpc-07c455142af847e81` (previous assignment, left intact) remains in the account; no stray volumes/snapshots/EIPs. Lab complete 2026-08-11.
- 2026-08-11: **Phase 9 load test passed live** — bastion `i-09f7270e3f084f6f9` (AL2023, t2.micro, public subnet 1, public IP `100.54.14.242`, SG `elast-bastion-sg`); two-hop agent-forwarded SSH (`ssh -A` → webserver private IPs `10.0.2.229` / `10.0.3.125`); `stress 1.0.7` installed on both webservers via NAT (outbound verified). Stressed **both** instances (`stress --cpu 1 --timeout 600s`, the group-average caveat applied): AlarmHigh fired ~3.5 min in → ASG scaled 2 → 3 → 4 (max); ALB kept serving all four; stress ended at ~10 min → CPU fell to ~1.4% → after the ~15 min Low-alarm evaluation window the ASG terminated back to 2 (23:40/23:42 UTC), never below min. Site healthy throughout (`webserver-elb-1452504383…`, instances `i-0da2232c57d58aa4c` + `i-0128cc1766c221a9d`).
- 2026-08-11: **Phases 7–8 built live**: `webserver-asg` (LT v1, app subnets `.2`/`.3`, min/desired 2 / max 4, ELB health checks, target-tracking `cpu-target-60` @ 60 % avg CPU) — both instances InService, one per AZ. **IMDSv2 gotcha found & fixed:** the professor's verbatim `index.php` reads `http://instance-data/latest/meta-data/instance-id` (IMDSv1, no token) — AL2023 AMIs ship `HttpTokens=required`, so the ID rendered blank. Fixed at the **template level** (LT v2 with `HttpTokens=optional`; served payload stays verbatim) → ASG updated + instance refresh → IDs render and requests alternate across instances. **Resilience check:** terminated one instance → ASG launched replacement `i-0444028cb0391e8e4` (same user-data bootstrap, healthy, serving) — site up throughout. ALB DNS: `webserver-elb-1452504383.us-east-1.elb.amazonaws.com`.
- 2026-08-11: **Phase 6 ALB + target group built live**: `webserver-tg` (instances, HTTP:80, health check `/`, 2/5 thresholds, 30 s interval, empty pool — ASG registers targets) and internet-facing `webserver-elb` in both public subnets (`elast-subnet-public1-us-east-1a` + `public2-us-east-1b`) with `elast-alb-sg`, listener HTTP:80 → `webserver-tg`. State active, DNS `webserver-elb-1452504383.us-east-1.elb.amazonaws.com`.
- 2026-08-11: **Phase 5 launch template built live**: `webserver-lt` v1 — latest stock AL2023 `ami-0bdc7d025135d7b49` (2023.12.20260803.3), `t2.micro`, key `summer-2026`, SG `elast-app-sg`, instance profile `webserver-role`, detailed monitoring on, AL2023 user-data (systemd httpd + `aws s3 cp` bootstrap) embedded, no subnet (ASG picks AZs). Verified via describe-launch-template-versions (UserData decoded). S3 pre-check: `GetObject` on `s3://seis665-public/index.php` confirmed (142 B) — List is denied on the class bucket, but the copy only needs GetObject.
- 2026-08-11: **Phase 4 Multi-AZ RDS built live**: `elast-db-prod` (MySQL, `db.t4g.micro` — t3 no longer offered for MySQL, per the previous assignment), Multi-AZ, gp3 20 GiB (3000 baseline IOPS), no storage autoscaling, public access off, SG `elast-db-sg`, DB subnet group `elast-db-subnet-group` (10.0.4.0/24 + 10.0.5.0/24) — status `available`, endpoint `elast-db-prod.c6to8euw2plx.us-east-1.rds.amazonaws.com`. Master user `admin`; password generated and stored in `projects/personal/elast-db-prod.credentials.md` (gitignored). CLI gotcha noted: `--iops` on gp3 is rejected below 400 GiB for MySQL — omitted (gp3 baseline is 3000 IOPS).
- 2026-08-11: **Phase 3 security groups built live** in `elast-vpc`: `elast-alb-sg` (HTTP 80 from anywhere), `elast-bastion-sg` (SSH 22 from home IP `73.5.176.162/32`), `elast-app-sg` (HTTP 80 ← `elast-alb-sg`, SSH 22 ← `elast-bastion-sg`), `elast-db-sg` (MySQL 3306 ← `elast-app-sg`); default outbound untouched. Cross-SG references verified via describe-security-groups.
- 2026-08-11: **Phase 2 role built live**: IAM role `webserver-role` (EC2 trust) + `AmazonS3FullAccess` attached, and the matching instance profile `webserver-role` created and associated via CLI (the console does the profile step automatically — CLI makes it explicit). Verified via `get-role` / `list-attached-role-policies` / `get-instance-profile`. User-data script itself is documented above and embeds in the launch template at Phase 5 (no separate live artifact).
- 2026-08-11: **Phase 1 rebuilt live as the wizard-equivalent build** — the 2026-08-10 manual build (and the stray `cafe-build` instance + `build-sg` from the superseded AMI attempt) were torn down and recreated via CLI with wizard-style names (`elast-subnet-public1-us-east-1a`, `elast-rtb-public`, `elast-rtb-private1-4-…`, `elast-natgateway-a/b`, `elast-eip-a/b`), auto-assign public IP ON for both public subnets, and NAT routes on **all four** private RTs (DB subnets included, per the wizard/demo behavior). Full checklist re-verified against live account 762760349846 — every item green. Caveat: the "VPC and more" wizard itself is console-only; the CLI replica reproduces its exact topology, naming, and behaviors.
- 2026-08-11: **Walkthrough realigned to the professor's demonstrated method** after reviewing his demo notes against the file:
  - **Phase 1 → "VPC and more" wizard** (auto-generated name tags, 2 AZs, /24 CIDRs, NAT 1-per-AZ zonal, **no VPC endpoints**, DNS hostnames + resolution) — replaces the manual build; 4 private subnets selected (demo showed 2; the diagram needs 4 for the DB tier).
  - **Golden AMI dropped entirely** → Phase 2 is now IAM role (`webserver-role`, **AmazonS3FullAccess** — the `aws s3 cp` in user data signs with instance-profile credentials) + the professor's **user-data bootstrap verbatim** (`s3://seis665-public/index.php`), with the **AL2023 fix** documented (`service`/`chkconfig` are absent on AL2023 → `systemctl enable --now httpd`).
  - **Launch template** uses the stock AL2023 AMI + user data; **S3 gateway endpoint removed** from the RDS phase (no endpoints per demo); **ALB/TG renamed** `webserver-elb`/`webserver-tg` (professor's `webserver_elb` — underscores invalid in ELB names).
  - **Phase 9 → bastion + `stress`** exactly per the handout (bastion SG added, app SG gains SSH-from-bastion; agent forwarding, never copy the key). **Group-average caveat encoded:** one stressed instance out of two averages ~50% < the 60% target — stress both, or set target 50. Apache Benchmark kept as the sanctioned alternative.
  - Decision recorded: user-data payload = **professor's bucket verbatim** (simplest, closest match to the demo); the served app is the class `index.php`, not the café site — the report cites the demo script and notes this.

## Review

- Assignment brief fully captured: infrastructure-as-depicted, launch template, ASG, load balancer, app testing, and scaling-under-load testing all have dedicated phases with verify steps.
- Method matches the professor's demonstration end-to-end: "VPC and more" wizard (zonal NATs, no endpoints, DNS on), EC2 IAM role with S3 access, user-data S3 bootstrap (no golden AMI), internet-facing ALB across both AZs, HTTP-from-anywhere ingress, bastion + `stress` load test with `ab` as the alternative.
- Architecture follows the diagram exactly: `10.0.0.0/16` VPC, public subnets `.0`/`.1` (NAT each), app private subnets `.2`/`.3`, DB private subnets `.4`/`.5`, ALB in both public subnets, ASG in both app subnets, Multi-AZ RDS across both DB subnets.
- Known deviations from the literal demo, each justified inline: 4 private subnets instead of 2 (diagram requires the DB tier), layered SGs instead of one (strict superset), `webserver-elb` not `webserver_elb` (console constraint), `systemctl` fix in the user-data script (AL2023 dropped SysV tools), RDS phase retained (diagram, previous assignment).
- Phase 1 now validated live in wizard-equivalent form (CLI replica, 2026-08-11 — the console wizard is what the report documents; the replica matches its topology, names, and behaviors exactly, including auto-assign public IP on the public subnets and NAT routes on all four private RTs); cost caveats and console gotchas (EIP billing, NAT cost, target-tracking stabilization + group-average math, SG reference chains, VPC-endpoint default = S3 Gateway) called out inline.
- Report for Canvas: pending Aaron — cite the professor's demo script, the assignment PDF, and the AWS docs used.

## Related

- Project: [[2026-08-05-rds-multiaz-read-replica-assignment.project.md]] — the RDS Multi-AZ procedure this walkthrough reuses for the DB tier (Phase 4)
- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — the original VPC lab (IGW/NAT/bastion patterns) this assignment extends; also the fallback manual VPC build
- Todo: none yet
