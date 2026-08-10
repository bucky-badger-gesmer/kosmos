---
title: Elasticity & Availability Lab — Assignment Walkthrough
description: >
  Class assignment deliverables for making the café infrastructure highly scalable and reliable — step-by-step console walkthrough to build the 2-AZ architecture (VPC, NAT gateways, AMI, launch template, Auto Scaling group, ALB, Multi-AZ RDS) and demonstrate automatic scaling under load; the Canvas report is handled separately by Aaron
status: active
priority: high
owner: Aaron
created: 2026-08-09
tags: [aws, ec2, auto-scaling, launch-template, alb, load-balancer, nat-gateway, elasticity, availability, high-availability, assignment]
related_projects: [2026-08-05-rds-multiaz-read-replica-assignment.project.md, 2026-07-31-aws-vpc-lab.memory.md]
---

# Elasticity & Availability Lab — Assignment Walkthrough

## Summary

Extends the previous café application assignment by making the infrastructure **highly scalable and reliable**. The deliverable is the architecture in the assignment diagram: a 2-AZ VPC with public subnets (ALB + NAT gateways) and private subnets (Auto Scaling group of café app servers + Multi-AZ RDS), built via launch template, ASG, and load balancer, then verified with a real load test. **The walkthrough below is the deliverable; the Canvas report is handled by Aaron** (per assignment: step-by-step instructions + citations).

Scope: write-up first, then hands-on run. Console walkthrough in **us-east-1**. The previous assignment's instance and AMI were removed per teardown, so the golden image is **rebuilt from scratch** (Phase 2) from the café app source; a saved key pair is still assumed. Prerequisites VPC resources are **free**; runtime resources (2 NAT gateways ≈ $65/mo, ALB ≈ $17/mo, 2–4 `t2.micro` ≈ $17–34/mo, Multi-AZ RDS ≈ $38/mo) accrue hourly — stop/delete after the lab (see Teardown).

## Requirements

- [ ] **Infrastructure as depicted:** VPC `10.0.0.0/16`, 2 public subnets (with NAT gateways), 4 private subnets (2 app + 2 DB), IGW, ALB, Multi-AZ RDS
- [ ] **AMI:** golden image built from the café app source (original instance + AMI removed per teardown — rebuilt in Phase 2)
- [ ] **Launch template:** AMI, instance type, key pair, app security group
- [ ] **Auto Scaling group:** spans both app subnets (2 AZs), min 2 / desired 2 / max 4, attached to the ALB target group, CPU-based scaling policy
- [ ] **Load balancer:** internet-facing ALB in both public subnets, listener → target group → ASG instances
- [ ] **Test the web app:** reachable via the ALB DNS name
- [ ] **Test automatic scaling under load:** CPU load → scale-out → remove load → scale-in
- [ ] **Report for Canvas — step-by-step instructions + citations** *(Aaron, separate)*

## Walkthrough — Setup in AWS

> The deliverable: console steps to build the assignment architecture in **us-east-1**. Follow the phases in order. Everything is created from scratch (no class-lab assumption).

### Architecture recap (from the assignment diagram)

```
Internet
 ├── Internet Gateway
 └── ALB (Web-application-tier load balancer) — public subnets 1 & 2
       └── target group → Auto Scaling group of café app servers (private subnets 1 & 2)
             └── RDS: Primary (private subnet 3) + Multi-AZ standby (private subnet 4)
Public subnets each hold a NAT gateway → outbound internet for the private app subnets
VPC 10.0.0.0/16 · AZ A (subnets .0/.2/.4) · AZ B (subnets .1/.3/.5)
```

### Phase 1 — VPC, subnets, IGW, NAT gateways, route tables

**1. VPC**

1. VPC → **Your VPCs** → **Create VPC** → `VPC only` | Name: `elast-vpc` | IPv4 CIDR: `10.0.0.0/16` → **Create VPC**.
2. Select `elast-vpc` → **Actions** → **Edit VPC settings** → check **Enable DNS hostnames** → **Save**.
   - ⚠️ Do this **immediately** — it's easy to skip and everything later (ALB DNS name, RDS endpoints) depends on it.

**2. Subnets** (VPC → **Subnets** → **Create subnet**, VPC: `elast-vpc`) — six `/24`s exactly as the diagram:

| Name | CIDR | AZ |
|---|---|---|
| `pub-subnet-a` | `10.0.0.0/24` | `us-east-1a` |
| `pub-subnet-b` | `10.0.1.0/24` | `us-east-1b` |
| `priv-app-subnet-a` | `10.0.2.0/24` | `us-east-1a` |
| `priv-app-subnet-b` | `10.0.3.0/24` | `us-east-1b` |
| `priv-db-subnet-a` | `10.0.4.0/24` | `us-east-1a` |
| `priv-db-subnet-b` | `10.0.5.0/24` | `us-east-1b` |

**You must create all 6 subnets** (one per row below — the "Subnet name" field is the subnet's Name tag). Two ways, same result:

- **One form, 6 rows (fastest):** fill the first row (name / AZ / CIDR), click **Add new subnet** to add another row, repeat until all 6 rows exist, then click the final **Create subnet** button at the bottom. (Clicking "Add new subnet" does **not** create anything yet — only the final **Create subnet** button does.)
- **Or one at a time:** fill a single row, click **Create subnet**, repeat 6×.

(Check the AZs available to your account — the assignment only requires one AZ per subnet pair; substitute if `us-east-1b` is unavailable.)

**3. Internet gateway**

1. VPC → **Internet Gateways** → **Create internet gateway** → Name: `elast-igw` → **Create**.
2. Select it → **Actions** → **Attach to VPC** → `elast-vpc` → **Attach**.

**4. NAT gateways (one per AZ — the diagram shows one in each public subnet)**

1. EC2 → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate** → name `elast-eip-a`. Repeat for `elast-eip-b`.
2. VPC → **NAT gateways** → **Create NAT gateway**:
   - **Availability mode: `Zonal`** ← required for this lab. Zonal pins the NAT to one subnet, matching the diagram's one-NAT-per-AZ (and the route-table split below). Do **not** use `Regional` — that's a single gateway serving the whole VPC: cheaper (~half the NAT cost) but off-diagram, one EIP, a single point of failure, and the console hides the Subnet field when it's selected.
   - Name: `elast-nat-a` | Subnet: `pub-subnet-a` | Connectivity type: `Public` | Elastic IP: `elast-eip-a` → **Create NAT gateway**.
   - Name: `elast-nat-b` | Subnet: `pub-subnet-b` | Connectivity type: `Public` | Elastic IP: `elast-eip-b` → **Create NAT gateway**.
3. Wait for both to show **Available** (~2 min). ⚠️ Each NAT gateway is ≈ $0.045/hr ($32/mo) — this is the biggest cost in the lab, and **why we use two only for the app subnets** (RDS backups go out via the free S3 gateway endpoint, Phase 4).
4. Note the NAT gateway IDs for the route tables below.

**5. Route tables** (VPC → **Route Tables** → **Create route table**, VPC: `elast-vpc`) — create three, using the exact names (they appear in your report; a typo like `elast-rt-rt-public` works functionally but looks wrong in the deliverable):

| Name | Route to add | Subnets to associate |
|---|---|---|
| `elast-rt-public` | `0.0.0.0/0` → **Internet Gateway** `elast-igw` | `pub-subnet-a`, `pub-subnet-b` |
| `elast-rt-app-a` | `0.0.0.0/0` → NAT gateway `elast-nat-a` | `priv-app-subnet-a` |
| `elast-rt-app-b` | `0.0.0.0/0` → NAT gateway `elast-nat-b` | `priv-app-subnet-b` |

For **each** route table, two separate actions are required — doing only one silently breaks the lab:

1. **Add the route:** select the RT → **Routes** tab → **Edit routes** → **Add route** → Destination `0.0.0.0/0`, Target = the IGW / NAT gateway from the table → **Save changes**.
2. **Associate the subnets:** **Subnet associations** tab → **Edit subnet associations** → check the subnets → **Save associations**.

- **DB subnets** stay on the **main route table** (local-only) — private, no internet route (RDS is AWS-managed and needs none).
- **Verify each RT:** the Routes tab shows the `0.0.0.0/0` row with the IGW / NAT gateway ID as target **and** the Subnet associations tab lists the right subnets. (Most common miss in a live run: the route — the RT is created and associated but no `0.0.0.0/0` is added, so the subnets stay local-only and private instances silently have no internet: `dnf` hangs, SSH times out.)

**✅ Phase 1 completion checklist** — all must be true before Phase 2:

- [ ] DNS hostnames **Enabled** on `elast-vpc` (VPC → Actions → Edit VPC settings)
- [ ] 6 subnets exist with the exact names/CIDRs/AZs (VPC → Subnets → search `elast-vpc`)
- [ ] `elast-igw` attached to `elast-vpc` (Internet Gateways → attachment column)
- [ ] `elast-nat-a` + `elast-nat-b` both `Available`, each with its EIP
- [ ] All 3 route tables show the `0.0.0.0/0` row with the right target, and the right subnet associations

### Phase 2 — Build the golden AMI from scratch

> The previous assignment's café instance **and** its AMI were deleted in teardown (as instructed), so the golden image is rebuilt from the café app source (`static-website`, the class's static HTML/CSS site). Build it once; Phase 5's launch template consumes the image exactly as the original plan intended.

1. (Optional sanity check) EC2 → **AMIs** / **Snapshots** / **Instances** — confirm no old café image remains before rebuilding.
2. EC2 → **Instances** → **Launch instances** — the temporary build instance:

   | Field | Value |
   |---|---|
   | Name | `cafe-build` |
   | AMI | **Amazon Linux 2023** (Free tier eligible) |
   | Instance type | `t2.micro` |
   | Key pair | your existing key pair (e.g. `summer-2026`) |
   | Network → VPC / Subnet | `elast-vpc` → `pub-subnet-a` |
   | Auto-assign public IP | **Enable** (needs the Phase 1 public route — done) |
   | Firewall | create SG `build-sg` with **SSH from your IP `/32`** only (temporary — deleted in teardown) |

   → **Launch instance**, wait for `2/2 checks passed`. Note the public IP.
3. Install the web server and deploy the café site (from your workstation):
   ```bash
   scp -i ~/.ssh/<key>.pem -r /Users/agesmer/Downloads/static-website/* ec2-user@<build-public-ip>:/tmp/
   ssh -i ~/.ssh/<key>.pem ec2-user@<build-public-ip>
   sudo dnf install -y httpd
   sudo systemctl enable --now httpd
   sudo cp -r /tmp/index.html /tmp/css /tmp/images /var/www/html/
   curl localhost     # → "Welcome to the Café!" (port 80 verified)
   ```
4. **Actions** → **Image and templates** → **Create image**:
   - Image name: `cafe-app-ami` | Image description: `café app server, port 80, Amazon Linux`
   - (Optional) **Instance reboot:** `No reboot` if you want zero downtime (slightly less consistent image).
5. EC2 → **AMIs** → wait for state `available` (2–5 min).
   - ⚠️ This AMI is the basis of the launch template — if the app isn't on port 80 in this image, none of the later health checks will pass.
6. **Terminate `cafe-build`** — it has served its purpose; only the AMI matters. (A stopped `t2.micro` costs ~$0.01/hr, so don't leave it running.)

### Phase 3 — Security groups (EC2 → **Security groups** → **Create security group**)

| Group | VPC | Inbound rules |
|---|---|---|
| `elast-alb-sg` | `elast-vpc` | HTTP `80` from `0.0.0.0/0` |
| `elast-app-sg` | `elast-vpc` | HTTP `80` from **Security group** `elast-alb-sg` (not an IP — only the ALB can reach the app); SSH `22` from your IP `/32` (debugging; skip if not needed) |
| `elast-db-sg` | `elast-vpc` | MySQL/Aurora `3306` from **Security group** `elast-app-sg` |

### Phase 4 — Multi-AZ RDS (primary in private subnet 3, standby in private subnet 4)

1. RDS → **Databases** → **Create database** → Standard create → engine from the previous assignment (MySQL/MariaDB).
2. **Templates:** `Production` | **Availability & durability:** **Multi-AZ DB instance**.
3. **Settings:** identifier `elast-db-prod` | Instance class `db.t3.micro` (or the class you used before) | Master username/password as before.
4. **Connectivity:** VPC `elast-vpc` | **DB subnet group:** create one — name `elast-db-subnet-group`, add `priv-db-subnet-a` + `priv-db-subnet-b` | Public access: **No** | VPC security group: `elast-db-sg`.
5. **Storage — fix the Production defaults** (they jump the estimate to ~$700/mo): **gp3** / **20 GiB** / **3000 IOPS**, storage autoscaling off.
6. **Additional configuration → Backup:** keep automated backups ON, and add the **S3 gateway endpoint** so backups can upload without an internet route (VPC → **Endpoints** → **Create endpoint** → `com.amazonaws.us-east-1.s3` → gateway type → VPC `elast-vpc` → **route tables: the main route table** → Create). Backups are free of NAT charges this way.
7. **Create database** → wait for `Available` (5–10 min). Full Multi-AZ verify/failover steps: see [[2026-08-05-rds-multiaz-read-replica-assignment.project.md]] Tutorial 1 (same procedure, this VPC).
   - The café app is a **static site** (no DB reads) — the database exists to satisfy the architecture; nothing to seed or wire. Only the SG chain matters (`elast-db-sg` ← `elast-app-sg` ← `elast-alb-sg`).

### Phase 5 — Launch template

EC2 → **Launch Templates** → **Create launch template**:

| Field | Value |
|---|---|
| Launch template name | `cafe-app-lt` |
| Application and OS Images | **My AMIs** → `cafe-app-ami` |
| Instance type | `t2.micro` (class-lab size; the previous assignment's type) |
| Key pair | your existing key pair |
| Network settings → Security groups | `elast-app-sg` |
| Advanced → Detailed CloudWatch monitoring | **Enable** (needed for fast scaling metrics) |

- **Do not** pick a subnet in the template — the ASG chooses the AZ per instance.
- **Advanced → User data (optional):** add a bootstrap that also installs the load-test tool so every scaled-out instance can stress-test itself later:
  ```bash
  #!/bin/bash
  sudo dnf install -y stress-ng || sudo amazon-linux-extras install -y epel && sudo yum install -y stress
  ```
- Click **Create launch template** → the **"Launch instance from this template"** page that follows is *optional* — close it; the ASG launches the instances.

### Phase 6 — Load balancer (ALB + target group)

**1. Target group first** (EC2 → **Target Groups** → **Create target group**):

- Target type: `Instances` | Name: `cafe-app-tg` | Protocol: `HTTP` : `80` | VPC: `elast-vpc`.
- Health checks: protocol `HTTP`, path `/` (use the app's actual health path if it has one), healthy threshold `2`, unhealthy threshold `5`, interval `30` (lower to `10` during the load test for faster reaction), timeout `5`.
- **Register targets: none** — the ASG registers and deregisters instances automatically. Create the group with the empty pool.

**2. ALB** (EC2 → **Load Balancers** → **Create load balancer** → **Application Load Balancer**):

| Field | Value |
|---|---|
| Name | `cafe-app-alb` |
| Scheme | **Internet-facing** |
| IP address type | `IPv4` |
| VPC | `elast-vpc` |
| Mappings | `us-east-1a` → `pub-subnet-a`, `us-east-1b` → `pub-subnet-b` |
| Security groups | `elast-alb-sg` |
| Listener | HTTP `80` → forward to `cafe-app-tg` |

→ **Create load balancer**, wait for state `active` (2–5 min). Note the **DNS name** (`cafe-app-alb-<id>.us-east-1.elb.amazonaws.com`) — this is the app's new public URL.

### Phase 7 — Auto Scaling group

EC2 → **Auto Scaling Groups** → **Create Auto Scaling group**:

1. **Launch template:** `cafe-app-lt` → **Next**.
2. **Instance launch options:** Name `cafe-app-asg` | VPC `elast-vpc` | **Availability Zones and subnets:** `priv-app-subnet-a` + `priv-app-subnet-b` (private — instances have no public IP, which is correct; the ALB fronts them) → **Next**.
3. **Attach to an existing load balancer:** target groups → select `cafe-app-tg`. **Health checks:** tick **Elastic Load Balancing health checks** (keep EC2 health checks on too) → **Next**.
4. **Group size:** Desired `2` | Minimum `2` | Maximum `4` (assignment wants ≥2 for high availability; 4 gives headroom for the scale test).
5. **Scaling policies — select "Target tracking"** (simplest, self-tuning):
   - Policy: Average **EC2 CPU utilization**, target value `60`, instances needed `2`. This creates its own CloudWatch alarm automatically.
   - ⚠️ Target tracking needs **detailed CloudWatch monitoring** (enabled in the launch template) and a ~60 s **stabilization period** before it scales — don't expect instant reaction in the test.
6. **Instance maintenance / Additional settings:** defaults are fine; **Termination policy** default, **Scale-in protection: off** (you want the ASG to be able to shrink the group in the demo).
7. **Create Auto Scaling group** → **Instances** tab: two instances launch (one per AZ), pass health checks, and register into `cafe-app-tg`.

### Phase 8 — Test the web application

1. EC2 → **Load Balancers** → `cafe-app-alb` → copy the **DNS name**.
2. Browser: `http://<alb-dns-name>/` → the café app loads. ⚠️ The ALB DNS name is the **only** public path to the app — instances are private and have no public IPs.
3. EC2 → **Target Groups** → `cafe-app-tg` → **Targets** tab → both instances show **healthy**.
4. **Resilience check:** EC2 → **Instances** → select one ASG instance → **Instance state** → **Terminate** → watch the ASG launch a replacement automatically (EC2 → Auto Scaling Groups → `cafe-app-asg` → **Activity** tab). The app stays up throughout (the ALB keeps routing to the healthy instance).

### Phase 9 — Test automatic scaling under load

**Prepare the load generator** (a throwaway instance that hammers the ALB):

1. EC2 → **Launch instances** → name `load-gen` | AMI: Amazon Linux 2023 | type `t2.micro` | key pair yours | network: VPC `elast-vpc`, subnet `pub-subnet-a`, auto-assign public IP **Enable** | SG: create `loadgen-sg` with SSH from your IP `/32` → **Launch instance**.
2. SSH in and install an HTTP load tool:
   ```bash
   sudo dnf install -y wget
   wget https://github.com/rakyll/hey/releases/download/v0.1.4/hey_linux_amd64 && chmod +x hey_linux_amd64
   ```

**Run the load test:**

3. From `load-gen`, blast the ALB (CPU goes up on the instances as they serve requests):
   ```bash
   ./hey_linux_amd64 -z 5m -c 100 http://<alb-dns-name>/
   ```
   (`-z 5m` = 5 minutes of sustained load, `-c 100` = 100 concurrent connections.)
4. Watch scale-out live: EC2 → **Auto Scaling Groups** → `cafe-app-asg` → **Activity** tab: `Launching a new EC2 instance` entries appear. **Instances** tab grows toward the max of 4. CloudWatch → **Alarms** shows the CPU alarm `In alarm`.
5. Optional (direct stress, no network dependency): SSH to an ASG instance and run `sudo stress-ng --cpu 2 --timeout 5m` — same effect.
6. **Stop the load** (Ctrl-C in `load-gen`) → within the scale-in window the ASG returns to desired 2: **Activity** tab shows `Terminating EC2 instances`; the ASG won't drop below minimum `2`.
7. **Verify:** the app remains reachable through the ALB for the whole test — no downtime, elastic both ways.

## Teardown (after the lab)

1. EC2 → **Auto Scaling Groups** → `cafe-app-asg` → **Delete** → confirm (delete the launch template too if prompted). EC2 → **Instances** → terminate `load-gen`.
2. EC2 → **Load Balancers** → delete `cafe-app-alb` → then **Target Groups** → delete `cafe-app-tg` (ALB must go first).
3. VPC → **NAT gateways** → select `elast-nat-a` + `elast-nat-b` → **Actions** → **Delete NAT gateway** (billing stops immediately). EC2 → **Elastic IPs** → select both → **Actions** → **Release** (⚠️ EIPs bill ~$3.60/mo each while unassociated).
4. RDS → **Databases** → delete `elast-db-prod` → untick final snapshot → confirm (deletion protection off — if blocked, **Modify → Deletion protection: untick → Apply immediately**).
5. EC2 → **AMIs** → deregister `cafe-app-ami` → delete the backing snapshots (EC2 → **Snapshots** → select → **Delete**) if no longer needed (they bill per GB/mo).
6. VPC hygiene (all free but should go): route tables `elast-rt-app-a/b` + `elast-rt-public` → delete; subnets → delete all six; **Endpoints** → delete the S3 endpoint; security groups → delete `loadgen-sg`, `elast-db-sg`, `elast-app-sg`, `elast-alb-sg` (in that order — SGs referenced by others fail until the referrer is gone); **Internet Gateways** → detach + delete `elast-igw`; VPC → delete `elast-vpc`.

## Progress

- 2026-08-09: Project created from the assignment PDF (3 pages: extension brief, target architecture diagram, deliverables). Walkthrough drafted in phases 1–9 (VPC/IGW/NAT → AMI → SGs → RDS → launch template → ALB → ASG → app test → load test), matching the diagram's CIDR layout exactly; report marked as Aaron's part.
- 2026-08-10: Phase 2 rewritten as a **from-scratch AMI build** — the previous assignment's café instance AND its AMI were deleted per teardown instructions, so the golden image is now rebuilt from the class's `static-website` source on a fresh Amazon Linux 2023 instance (`cafe-build` → `cafe-app-ami`). App confirmed static (no DB reads) → Phase 4 DB tier is architecture-only; scope note and requirement updated accordingly.
- 2026-08-10: Phase 1 rewritten after a **live validation pass** on account 762760349846 — the failure points from the run are now encoded in the walkthrough: subnet form mechanics (6 rows via **Add new subnet**, "Subnet name" = Name tag), NAT **availability mode `Zonal`** (Regional explained as the off-diagram alternative), route tables split into two explicit actions (**add the route** + **associate subnets** — the route was missed live, leaving RTs local-only), exact-name callout (`elast-rt-rt-public` typo), DNS-hostnames emphasis, and a Phase 1 completion checklist. Phase 1 fully validated green after fixes.

## Review

- Assignment brief fully captured: launch template, ASG, load balancer, app testing, and scaling-under-load testing all have dedicated phases with verify steps.
- Architecture follows the diagram exactly: `10.0.0.0/16` VPC, public subnets `.0`/`.1` (NAT each), app private subnets `.2`/`.3`, DB private subnets `.4`/`.5`, ALB in both public subnets, ASG in both app subnets, Multi-AZ RDS across both DB subnets.
- Not yet validated live; expected-cost caveats and console gotchas (EIP billing, NAT cost, target-tracking stabilization, SG reference chains) called out inline.
- Report for Canvas: pending Aaron.
- 2026-08-10: Rebuild branch added — the original instance+AMI no longer exist (teardown), so Phase 2 now builds the golden image from the app source; everything downstream (launch template, ASG, ALB, tests) is unchanged. Not yet validated live.
- 2026-08-10: Phase 1 validated live against account 762760349846 — all checklist items green (VPC, DNS hostnames, 6 subnets, IGW, 2 NATs + EIPs, 3 RTs with routes + associations, DB subnets on main RT). Walkthrough updated to encode the run's confusion points; Phases 2–9 left as-is (worked as written).

## Related

- Project: [[2026-08-05-rds-multiaz-read-replica-assignment.project.md]] — the RDS Multi-AZ procedure this walkthrough reuses for the DB tier (Phase 4)
- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — the original VPC lab (IGW/NAT/bastion patterns) this assignment extends
- Todo: none yet
