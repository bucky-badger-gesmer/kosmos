---
title: RDS Multi-AZ & Read Replicas — Assignment Write-up
description: >
  Class assignment deliverables on Amazon RDS high availability and scale-out — step-by-step console tutorials for Multi-AZ deployment and read replicas (the walkthrough deliverable); the report sections are reference notes written by Aaron
status: active
priority: high
owner: Aaron
created: 2026-08-05
tags: [aws, rds, multi-az, read-replica, high-availability, database, assignment]
related_projects: [2026-07-31-aws-vpc-lab.memory.md]
---

# RDS Multi-AZ & Read Replicas — Assignment Write-up

## Summary

A single RDS instance is a single point of failure: it lives in one AZ, has one copy of the data, and serves every read and write. This assignment makes it production-grade — two tutorials showing how to enable Multi-AZ deployment (availability) and read replicas (read scaling). **The walkthrough below is the deliverable; the report is handled by Aaron.**

Scope: write-up + optional hands-on run. Tutorials are console walkthroughs in **us-east-1**, in the same style as the VPC lab memory. Engine shown as **MySQL/MariaDB** (matches the class lab); substitute your lab's engine everywhere it appears. All prerequisite VPC resources are **free**; during a live run the RDS instances (≈$14–38/mo while running) and the bastion (`t2.micro` ≈ $8.50/mo while running) accrue hourly costs — stop/delete after the lab (see Teardown).

## Requirements

- [x] **Tutorial 1:** Step-by-step instructions for configuring RDS with Multi-AZ deployment (based on the class lab)
- [x] **Tutorial 2:** Step-by-step instructions for configuring RDS with read replicas (based on the class lab)
- [x] **Tutorial 3:** Bastion EC2 + routing reads to the replica (the lab connection path for the walkthrough's `mysql` commands)
- [ ] **Report — reliability, availability, latency:** How Multi-AZ and read replicas help RDS in each of the three dimensions *(Aaron)*
- [ ] **Report — cost:** Change in operational cost when Multi-AZ and read replicas are enabled *(Aaron)*
- [ ] **Report — coexistence:** Can Multi-AZ and read replicas coexist? If yes, step-by-step implementation instructions *(Aaron)*

## Walkthrough — Setup in AWS

> The deliverable: console steps to create a Multi-AZ RDS instance and add a read replica to it. Run through these in **us-east-1**.

### Tutorial 1 — Multi-AZ deployment

Multi-AZ **synchronous** replication maintains a standby instance in a second AZ. Failover is automatic and the endpoint (DNS name) doesn't change, so applications keep working.

**Prerequisites**

1. Sign in to the AWS Management Console → select **us-east-1** in the top-right.
2. Network resources built from scratch (no class-lab assumption) — all **~$0/mo**, no EC2 instances or NAT gateway:
   - **VPC** `lab-vpc` (`10.0.0.0/16`) with **DNS hostnames** enabled.
   - Two **private** subnets in **different AZs** — Multi-AZ requires subnets in at least two AZs:
     - `rds-subnet-1a` → `10.0.1.0/24` → `us-east-1a`
     - `rds-subnet-1b` → `10.0.2.0/24` → `us-east-1b`
   - **S3 gateway VPC endpoint** (`com.amazonaws.us-east-1.s3`) on the main route table — lets RDS upload automated backups to S3 without an internet/NAT gateway (this is what keeps the setup free). The route table association is required — see step 3.
   - **DB subnet group** `lab-db-subnet-group` (RDS → Subnet groups) containing both private subnets.
   - **Security group** `rds-sg` (VPC `lab-vpc`) allowing MySQL/MariaDB (**3306**) from your app tier's security group — or from your workstation IP `/32` temporarily if testing directly.

**Build-from-scratch console steps** (if you don't already have the above):

1. VPC → **Your VPCs** → **Create VPC** → `VPC only` | Name: `lab-vpc` | IPv4 CIDR: `10.0.0.0/16` → **Create VPC**. Select it → **Actions** → **Edit VPC settings** → check **Enable DNS hostnames** → **Save**.
2. VPC → **Subnets** → **Create subnet** (VPC: `lab-vpc`) twice:
   - Name: `rds-subnet-1a` | AZ: `us-east-1a` | IPv4 CIDR: `10.0.1.0/24`
   - Name: `rds-subnet-1b` | AZ: another AZ (e.g. `us-east-1b`) | IPv4 CIDR: `10.0.2.0/24`
   - No IGW, no NAT, no route table changes — the subnets stay on the main (local-only) route table.
3. VPC → **Endpoints** → **Create endpoint**: search for `S3` and select **Amazon S3** (`com.amazonaws.us-east-1.s3`) | **Endpoint type:** `Gateway` (ignore the "Endpoint services that use NLBs and GWLBs" list — that's for private services, not AWS services) | VPC: `lab-vpc` | **Route tables:** select the main route table — **required**, this is what adds the S3 route | Policy: Full access → **Create endpoint**. Wait for state `Available` (a minute or two).
   - ⚠️ **Don't skip the route table selection** — an endpoint created without one shows `Available` but routes nothing (the S3 route never appears in the route table). Fix later: Endpoints → select the endpoint → **Actions** → **Manage route tables** → check the main route table → **Modify**.
   - **Verify:** VPC → **Route Tables** → the row with **Main = Yes** → **Routes** tab → a row: Destination `pl-63a5400a`, Target `vpce-0430da6e0a62f1182` (shows as the raw endpoint ID, not `lab-s3-endpoint`). `pl-63a5400a` is the S3 prefix list (`com.amazonaws.us-east-1.s3`) — the console shows only the ID here. Or check the endpoint instead: VPC → **Endpoints** → `lab-s3-endpoint` → **Route tables** section lists the main route table. (The prefix list ID is account-scoped — match the pattern, not the literal ID.)
4. RDS → **Subnet groups** → **Create DB subnet group**: Name: `lab-db-subnet-group` | VPC: `lab-vpc` | Add subnets: `rds-subnet-1a` + `rds-subnet-1b` → **Create**. (A banner saying "For Multi-AZ DB clusters, you must select 3 subnets in 3 different Availability Zones" is for the Multi-AZ **DB cluster** feature only — ignorable. This walkthrough uses Multi-AZ **DB instance**, which needs just 2 subnets in 2 AZs.)
5. EC2 → **Security groups** → **Create security group**: Name: `rds-sg` | VPC: `lab-vpc` | Inbound rule: Type `MySQL/Aurora`, Port `3306`, Source: your app tier's SG (or leave empty and add later; never `0.0.0.0/0`) → **Create security group**.

**Create the database with Multi-AZ**

1. RDS dashboard → **Databases** → **Create database**.
2. **Database creation method:** `Standard create`.
3. **Engine options:** `MySQL` (or your lab's engine, e.g. MariaDB) → **Version**: default latest.
4. **Templates:** `Production` (Multi-AZ options only appear reliably under Production; Dev/Test disables them). If staying in free-tier budget, this step documents the Production default — instance size in step 5 can still be small.
5. **Settings** → DB instance identifier: `lab-db-prod`.
6. **Instance configuration:** Burstable class: `db.t3.micro` (a lab-sized instance; real production would use much larger). If `t3` isn't listed in your console, use `db.t4g.micro` (current-gen equivalent). If the class dropdown seems to lack t-classes entirely, you're likely on **Multi-AZ DB cluster** (see step 7) — switch to **Multi-AZ DB instance** and type `t3`/`t4g` in the class search box.
7. **Availability & durability:** Deployment options → **Multi-AZ DB instance** (this is the switch that enables Multi-AZ; the alternate options are Multi-AZ DB cluster and Single DB instance). A banner "For Multi-AZ DB clusters, you must select 3 subnets in 3 different Availability Zones" refers only to the *cluster* option — ignorable for Multi-AZ DB instance.
8. **Connectivity:**
   - Virtual Private Cloud (VPC): `lab-vpc`
   - DB subnet group: `lab-db-subnet-group` (must span ≥2 AZs)
   - Public access: **No** (database stays private — no public endpoint)
   - VPC security group: `rds-sg`
9. **Authentication:** Master username `admin`, master password of your choice. If the DB is later recreated (or you want to change the password), the password is whatever was set at creation — change it via **Modify → Settings → Master password** → **Apply immediately** (a few seconds of downtime).
10. **Initial database name (optional):** `appdb` — creates the schema automatically.
11. Leave backups enabled (default 7-day retention; Multi-AZ requires automated backups on).
12. **Storage — fix the Production-template defaults before creating** (same Create database page, below Backups): the template defaults to **100 GiB** and **provisioned IOPS**, which makes the **Estimated monthly costs show ~$725** (≈$25 instance + $100 storage + $600 IOPS). Set:
    - Storage type: **General Purpose SSD (gp3)** (not io1/io2)
    - Allocated storage: **20 GiB**
    - Storage IOPS: **3000** (gp3 baseline — included, no extra charge)
    - Storage autoscaling: off, or max 40 GiB
    - Instance class from step 6 (`db.t3.micro`) should then be the only line in the estimate (~$14–19/mo total).
13. Scroll to **Additional configuration** → **Backup** → keep enabled → **Create database**.
14. Wait for status `Available` (can take 5–10 minutes).
    - **Expected event sequence** (Events page): `DB instance created` → `Applying modification to convert to a Multi-AZ DB Instance` → `Finished applying modification…` → `Available`. The "convert" event fires even for native Multi-AZ creates — it's how RDS builds the standby, **not** a stuck state. Don't touch the instance while status shows `creating`/`modifying`; it resolves on its own in ~7–8 minutes.

**Verify Multi-AZ**

1. RDS → **Databases** → **click the DB identifier `lab-db-prod` (the name text, not the radio button)** to open the instance's details page. The list view doesn't show AZs — you must be on the details page.
2. **Connectivity & security** tab → **Availability zone** and **Secondary AZ** rows — the console now shows the primary AZ and a different secondary AZ (e.g. `us-east-1a` + `us-east-1b`).
3. **Configuration** tab → **Multi-AZ deployment** row shows `Yes` (DB instance) / `Multi-AZ` badge.
4. Confirm the instance has a **hosted zone / CNAME endpoint** — failover moves the DNS target, the endpoint string stays the same.

**Test automatic failover**

1. Select `lab-db-prod` → **Actions** → **Reboot** → **Reboot with failover** → **Reboot**.
2. **Databases** tab: status flips to `Rebooting`, then a **Failover** event appears in the event log (bottom panel / **Events** page).
3. When status returns to `Available`, re-check the **Availability zone** — it has swapped with the secondary AZ.
4. Application impact: a DNS resolution switchover of roughly 60–120 seconds; the endpoint name is unchanged, so no application reconfiguration is needed.

> **Observed in the live lab (2026-08-07):** three failover tests across two instances (one console-created, one CLI-created native Multi-AZ) all produced the full event sequence (`Multi-AZ instance failover started` → `DB instance restarted` → `failover completed`) with the instance returning to `Available` in ~30–60 s and the endpoint unchanged — but the **Availability zone never swapped** (e.g. primary stayed `us-east-1b`). Consistent evidence across attempts points to the standby being physically co-located with the primary (same AZ) despite `Secondary AZ` reporting the other AZ — an AWS placement behavior on this account, not a configuration error. The failover *event*, automatic recovery, and endpoint stability all worked as documented; only the visible AZ swap was missing. If your assignment requires the AZ swap as evidence, note this as an observed deviation and rely on the event log + endpoint check instead.

### Tutorial 2 — Read replica

Read replicas are **asynchronous** copies of the primary used to serve read traffic and offload the primary. You create them from the primary with a few clicks.

1. Go to **RDS** → **Databases** → select `lab-db-prod` (the primary from Tutorial 1; a standalone instance works too).
2. **Actions** → **Create read replica**.
3. **Settings** → DB instance identifier: `lab-db-replica-1`.
4. **Instance configuration:** same engine automatically; pick `db.t3.micro` to match the primary.
5. **Connectivity:** same VPC, DB subnet group, and security group as the primary (`lab-vpc`, `lab-db-subnet-group`, `rds-sg`).
6. **Storage & CA — fix the defaults before creating:** keep **gp3 / 20 GiB / 3000 IOPS** like the primary, and set **Storage autoscaling: off** (it defaults ON with max 1000 GiB — a cost gotcha; in a lab it will never trigger, but disable it anyway). **Certificate Authority:** accept the suggested/default CA (it matches the primary's — the CA only matters for TLS client connections later). Then **Create read replica**.
   - **Creation takes ~7–10 min and doesn't look like the primary's create.** The event log shows a snapshot restore of the primary (`Restored from snapshot` + multiple `DB instance restarted` events) — that's the normal replica-creation mechanism, not a crash. If you enabled Multi-AZ on the replica, it then goes through its own `modifying`/Multi-AZ conversion (~7 min) — also normal, not stuck. `Replication resumed` in the events means it's live.

**Verify the replica**

1. **Databases** → both `lab-db-prod` and `lab-db-replica-1` appear. The replica column shows a **Replication role** of `Replica`, and the replica's row lists its **primary** (`lab-db-prod`).
2. **Connectivity & security** tab of the replica → note the **endpoint** — it is a separate DNS name from the primary (applications use it for reads).
3. **Monitoring** tab → **CloudWatch metrics** → check **Replication Lag** (seconds): low/zero = the replica is keeping up; the **BinLog Disk Usage** on the primary feeds it. (The console label is "Replication Lag"; the underlying metric is **`ReplicaLag`** — e.g. `aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name ReplicaLag --dimensions Name=DBInstanceIdentifier,Value=lab-db-replica-1 --statistics Maximum`.)

### Tutorial 3 — Connect via bastion & route reads to the replica

The RDS instances are **private** (public access off), so the `mysql` commands can't run from your laptop — you need a small EC2 **bastion** inside the VPC (the class-lab pattern: bastion → database). It also gives you a real "app tier" to point at the two endpoints.

**Network prep** (VPC console)

1. VPC → **Internet Gateways** → **Create internet gateway** → Name: `lab-igw` → **Create** → select it → **Actions** → **Attach to VPC** → `lab-vpc`.
2. VPC → **Subnets** → **Create subnet**: Name: `lab-public-subnet` | VPC: `lab-vpc` | AZ: `us-east-1a` | IPv4 CIDR: `10.0.3.0/24` → **Create**. Select it → **Actions** → **Edit subnet settings** → check **Enable auto-assign public IPv4 address** → **Save**.
3. VPC → **Route Tables** → **Create route table**: Name: `lab-public-rt` | VPC: `lab-vpc` → **Create**.
   - **Subnet associations** tab → **Edit subnet associations** → check `lab-public-subnet` → **Save associations** ← required; without this the subnet keeps the local-only main route and the bastion has no internet.
   - **Routes** tab → **Edit routes** → **Add route**: Destination `0.0.0.0/0`, Target **Internet Gateway** → `lab-igw` → **Save changes**.

**Launch the bastion** (EC2 console)

4. **Key pair:** use an existing one (this account has `summer-2026`) or create one: EC2 → **Key Pairs** → **Create key pair** → download the `.pem` once (browser) → `chmod 400 ~/.ssh/<key>.pem`.
5. EC2 → **Instances** → **Launch instances**: Name `bastion` | AMI: **Amazon Linux 2023** | Type: `t2.micro` | Key pair: yours | **Network settings** → Edit: VPC `lab-vpc`, Subnet `lab-public-subnet`, Auto-assign public IP `Enable`, Firewall: Create SG → name `bastion-sg`, inbound: **SSH from your IP `/32`** → **Launch instance**. Note its public IP.
6. **Allow the bastion to reach the databases:** EC2 → **Security groups** → select `rds-sg` → **Edit inbound rules** → **Add rule**: Type `MySQL/Aurora`, Port `3306`, Source: **Security group** → `bastion-sg` → **Save rules**. (Referencing the SG instead of an IP means "any instance carrying `bastion-sg`" — the walkthrough's app-tier pattern. The laptop-IP rule on `rds-sg` is now dormant, which is fine; remove it if you want.)

**Run the demo** (from your workstation)

7. `ssh -i ~/.ssh/<key>.pem ec2-user@<bastion-public-ip>` → `sudo dnf install -y mariadb105` (the MariaDB client — AL2023's default repos have **no `mysql` package**, so `dnf install -y mysql` fails with "No match for argument: mysql"). `mariadb105` is a drop-in: it installs the same `mysql` binary speaking the MySQL wire protocol, so all commands below work unchanged. (Install once per bastion.)
8. Writes → **primary** endpoint:
   ```bash
   mysql -h <primary-endpoint> -u admin -p appdb   # e.g. lab-db-prod.c6to8euw2plx.us-east-1.rds.amazonaws.com
   ```
   - The `appdb` argument selects the database — omit it and you get `ERROR 1046 (3D000): No database selected` (or run `USE appdb;` in-session). The prompt shows `MySQL [appdb]>` when a database is selected.
   - **TLS (recommended, and required by MySQL 8.4's default `require_secure_transport`):** download the RDS CA bundle and connect with identity verification:
     ```bash
     curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
     mysql -h <primary-endpoint> -P 3306 -u admin -p --ssl-mode=VERIFY_IDENTITY --ssl-ca=./global-bundle.pem appdb
     ```
     If your client rejects `--ssl-mode=VERIFY_IDENTITY`, fall back to `--ssl-ca=global-bundle.pem` (older ssl-mode syntax).
   - → `CREATE TABLE lab_demo (id INT, note VARCHAR(50));` → `INSERT INTO lab_demo VALUES (1, 'hello');`
9. Reads → **replica** endpoint:
   ```bash
   mysql -h <replica-endpoint> -u admin -p appdb   # e.g. lab-db-replica-1.<…>.us-east-1.rds.amazonaws.com
   ```
   → `SELECT * FROM lab_demo;` — the row is there (asynchronous replication, lag ≈ 0).
10. **Negative test:** on the replica, `INSERT INTO lab_demo VALUES (2, 'nope');` → fails with an error. The replica accepts only read statements (`SELECT`); writes to it fail — that's the point: it offloads reads, it never takes writes.

In a real app you'd configure the web tier with two connection pools: writes and critical reads → primary; reports/analytics/high-volume reads → replica.

### Report — reliability, availability, and latency

> **Aaron's part.** Reference notes below are starting points for the final report; rewrite in your own words per the assignment prompt.

**Multi-AZ (availability + reliability)**

- **Availability:** A standby is synchronously replicated in a different AZ. If the primary's AZ fails, the instance is lost, or the primary becomes unhealthy, RDS fails over automatically to the standby (60–120 s DNS cutover). The endpoint is unchanged, so the application keeps working with no code changes. This removes a whole AZ as a single point of failure.
- **Reliability:** Every committed transaction is copied to the standby synchronously before commit returns — a failed primary has a complete, current copy of the data (no data loss on failover). This is also what makes maintenance windows and patching non-disruptive: RDS fails over to the standby and reboots the primary behind the scenes.
- **Latency:** No read benefit — the standby does **not** serve reads or reduce load; it idles until failover. Writes pay a small latency cost (every write must be acknowledged by the standby in another AZ before commit).

**Read replicas (latency + availability/reliability side effects)**

- **Latency / performance:** Replicas absorb read traffic, so reads answer faster and the primary is less loaded — this lowers overall query latency when reads dominate (typical for web apps). Replication itself is asynchronous, so a replica can lag slightly behind the primary.
- **Availability / reliability:** A read replica is *not* an availability feature — a failure of the primary does not fail over automatically. You can manually **promote** a replica to become a new primary (minutes), which is the classic path to disaster recovery, but it is a deliberate action, not automatic. The data on a replica is a near-real-time copy, not transactionally guaranteed — an un-promoted replica can lag by seconds.
- **Combined effect:** Multi-AZ keeps the system *up*; replicas keep it *fast*. For a read-heavy app, Multi-AZ + replicas together give availability and latency headroom at the same time.

### Report — operational cost change

> **Aaron's part.** Reference notes below are starting points for the final report; verify current on-demand pricing before submitting.

- **Multi-AZ ≈ 2× the instance cost.** RDS bills the primary instance *and* the standby instance for every hour (same instance class). Storage is provisioned for both, and backup storage is doubled (backups are taken of both primary and standby). Rule of thumb: enabling Multi-AZ roughly doubles the monthly database bill before I/O.
- **Read replica = one more full instance bill.** Each replica is billed like a standalone instance of the same class (instance hours + storage + I/O). Same-region replicas have **no data-transfer charge** between primary and replica; a cross-region replica adds per-GB data-transfer costs on top.
- **Realistic numbers (on-demand, us-east-1):** lab class **db.t3.micro** ≈ $0.026/hr ≈ **$19/mo** (current-gen equivalent `db.t4g.micro` ≈ $0.016/hr ≈ $12/mo). With t3.micro: single instance ≈ $19/mo; Multi-AZ ≈ $38/mo; one same-region read replica ≈ $19/mo more (≈ $57/mo total with Multi-AZ). Reserved instances cut all of these but the relative shape holds.
- **Storage gotcha:** the Production template defaults (100 GiB + provisioned IOPS) inflate the wizard's monthly estimate to ~$700/mo. With gp3/20 GiB/3000 IOPS (the walkthrough's settings) storage adds only ~$1.60/mo. Provisioned IOPS (io1/io2) is billed per IOPS and dominates small-lab cost — avoid unless the workload needs it.
- **Takeaway:** availability and scale-out are not free — Multi-AZ is roughly 2×, each replica adds ~1× the base instance cost. The trade is acceptable where downtime is more expensive than the extra instance hours.

### Report — do Multi-AZ and read replicas coexist?

> **Aaron's part.** Reference notes below are starting points for the final report.

**Yes.** Multi-AZ and read replicas are independent RDS features that stack cleanly:

- A **Multi-AZ primary** can serve as the source of read replicas (replicas copy from the primary; the standby is not involved).
- A **read replica can itself be Multi-AZ** — you can convert a replica into a Multi-AZ deployment so the replica's standby survives AZ failure too.
- Failover of the primary keeps replicas working; after failover RDS re-sets replication from the new primary.

**Step-by-step — Multi-AZ primary + read replicas:**

1. Create the primary with Multi-AZ (Tutorial 1): RDS → **Create database** → Standard create → engine → **Multi-AZ DB instance** → subnet group spanning ≥2 AZs → **Create database**.
2. Create a replica of it (Tutorial 2): select the primary → **Actions** → **Create read replica** → instance class → same VPC/subnet group/security group → **Create read replica**.
3. (Optional) Make the replica Multi-AZ too: select `lab-db-replica-1` → **Modify** → **Availability & durability** → Deployment options → **Multi-AZ DB instance** → **Continue** → **Apply immediately**.
4. Verify: both instances `Available`; replica's Replication Role = `Replica`; replica's Availability zone + Secondary AZ differ; Replication Lag near 0.
5. Test failover: **Reboot with failover** on the primary → endpoint unchanged → replication resumes from the new primary automatically.
6. Point application reads at the replica endpoint, writes at the primary endpoint.

## Teardown (after the lab)

To avoid running costs after the hands-on run, delete the resources in this order:

1. EC2 → **Instances** → select `bastion` → **Instance state** → **Terminate** (stops the ≈$8.50/mo EC2 charge immediately).
2. RDS → **Databases** → select `lab-db-replica-1` → **Actions** → **Delete** → untick "Create final snapshot" → **Delete**.
3. Select `lab-db-prod` → **Delete** → untick "Create final snapshot" → **Delete**.
   - ⚠️ **Deletion protection must be OFF** (default in this walkthrough) — if Delete is blocked, **Modify → Deletion protection: untick → Apply immediately**, then delete.
4. (Optional but recommended — stops the $0 cost drift) VPC → **Route Tables** → delete `lab-public-rt`; VPC → **Subnets** → delete `lab-public-subnet`; VPC → **Internet Gateways** → detach + delete `lab-igw`; VPC → **Endpoints** → delete `lab-s3-endpoint`; EC2 → **Security groups** → delete `bastion-sg` + `rds-sg`; RDS → **Subnet groups** → delete `lab-db-subnet-group`; VPC → **Your VPCs** → delete `lab-vpc` (removes both private subnets). Key pair `summer-2026` can stay (it's free and reusable).
5. If the instance had storage autoscaling enabled, disabling it before delete is optional (the instance itself is what costs; the VPC stack is free but should still be cleaned for hygiene).

## Progress

- 2026-08-05: Project created; tutorials and report drafted per the assignment prompt (write-up only, no instances launched).
- 2026-08-05: Scoped to the walkthrough deliverable; report sections marked as Aaron's part with reference notes.
- 2026-08-06: Prerequisites reworked to a build-from-scratch set (~$0/mo): `lab-vpc` + two private subnets in different AZs + S3 gateway endpoint + `lab-db-subnet-group` + `rds-sg`, with click-by-click console steps; removed the class-lab assumption from all tutorial connectivity references.
- 2026-08-07: S3 endpoint step clarified — route table association made explicit (gateway endpoints route nothing without it), plus a fix path and a verify step; prerequisites validated live on the class account (VPC, 2 subnets in 2 AZs, DNS hostnames, S3 endpoint + route).
- 2026-08-07: Subnet references updated to `rds-subnet-1b` (`us-east-1b`, as actually built); added note that the "3 subnets in 3 AZs" banner applies to Multi-AZ DB clusters only, not the Multi-AZ DB instance this walkthrough uses.
- 2026-08-07: Instance class updated `db.t3.micro` → `db.t4g.micro` (t3 no longer offered for new MySQL instances) in Tutorials 1 & 2 and the cost report; added a storage gotcha to Tutorial 1 (Production-template defaults = 100 GiB + provisioned IOPS ≈ $725/mo estimate → set gp3/20 GiB/3000 IOPS for ~$13–14/mo).
- 2026-08-07: Reverted to `db.t3.micro` — the class actually used for this lab (still orderable in this account); t4g documented as the current-gen fallback.
- 2026-08-07: Live lab: rebuilt `lab-db-prod` cleanly via CLI (native `--multi-az`, gp3/20 GiB/3000 IOPS, no autoscaling, deletion protection off). Three failover tests across two instances: events fire and instance recovers in ~30–60 s with a stable endpoint, but the primary AZ never swapped (standby appears physically co-located) — documented as an observed deviation in the failover section. Added a Teardown section (delete replica → primary → VPC stack; deletion protection gotcha).
- 2026-08-07: Session-gap pass — added **Tutorial 3** (bastion EC2 + routing reads to the replica with the real connection path and demo), replica storage-autoscaling + CA notes (Tutorial 2 step 6), replica creation-behavior note (snapshot restore + Multi-AZ conversion = long `modifying`, not stuck), expected create timeline (Tutorial 1 step 14), explicit Verify-Multi-AZ console navigation (click the identifier text, Connectivity & security tab rows), `ReplicaLag` metric name + CLI command, master-password change note, scope/teardown updated for bastion + runtime costs, and fixed a stale `db.t4g.micro` reference in the storage bullet.
- 2026-08-07: Tutorial 3 refined with live-lab fixes — `sudo dnf install -y mysql` → `mariadb105` (AL2023 has no `mysql` package), the `appdb` positional arg / `USE appdb` (avoids `ERROR 1046`), and the recommended TLS-verified connect form (`--ssl-mode=VERIFY_IDENTITY --ssl-ca=global-bundle.pem`) with the client fallback note.

## Review

- Walkthrough deliverable complete: Tutorial 1 (Multi-AZ) and Tutorial 2 (read replica), including verification and failover steps.
- Console steps match the current RDS console flow in us-east-1 (Standard create → Production template → Multi-AZ DB instance → Reboot with failover → Create read replica).
- Prerequisites updated (2026-08-06) to a self-contained build-from-scratch set — no longer assumes the class VPC lab exists; all prerequisite resources are free to run and fully documented in the walkthrough.
- Report: pending Aaron (reference notes retained in this file).
- Live verification performed (2026-08-07) on the class account: prerequisites, Multi-AZ creation + verification, read replica with 0 s replication lag — all confirmed. One observed deviation documented: failover events fire and the instance recovers, but the primary AZ does not visibly swap (standby appears co-located; AWS-side placement behavior).

## Related

- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — the class VPC lab (VPC, subnets, subnet group, security groups) this assignment builds on
- Project: [[2026-08-03-aws-saa-practice-app-scaffold.project.md]] — SAA practice deck; RDS topics are SAA exam material
