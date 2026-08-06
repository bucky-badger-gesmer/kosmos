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

Scope: write-up only — no instances launched, no costs incurred. Tutorials are console walkthroughs in **us-east-1**, in the same style as the VPC lab memory. Engine shown as **MySQL/MariaDB** (matches the class lab); substitute your lab's engine everywhere it appears.

## Requirements

- [x] **Tutorial 1:** Step-by-step instructions for configuring RDS with Multi-AZ deployment (based on the class lab)
- [x] **Tutorial 2:** Step-by-step instructions for configuring RDS with read replicas (based on the class lab)
- [ ] **Report — reliability, availability, latency:** How Multi-AZ and read replicas help RDS in each of the three dimensions *(Aaron)*
- [ ] **Report — cost:** Change in operational cost when Multi-AZ and read replicas are enabled *(Aaron)*
- [ ] **Report — coexistence:** Can Multi-AZ and read replicas coexist? If yes, step-by-step implementation instructions *(Aaron)*

## Walkthrough — Setup in AWS

> The deliverable: console steps to create a Multi-AZ RDS instance and add a read replica to it. Run through these in **us-east-1**.

### Tutorial 1 — Multi-AZ deployment

Multi-AZ **synchronous** replication maintains a standby instance in a second AZ. Failover is automatic and the endpoint (DNS name) doesn't change, so applications keep working.

**Prerequisites**

1. Sign in to the AWS Management Console → **RDS** → select **us-east-1** in the top-right.
2. From the class lab, you already have: a VPC with a private DB subnet group (two subnets in different AZs), a security group allowing MySQL/MariaDB (port 3306) from your app tier. Multi-AZ **requires subnets in at least two AZs** — the class lab's subnet group already qualifies.

**Create the database with Multi-AZ**

1. RDS dashboard → **Databases** → **Create database**.
2. **Database creation method:** `Standard create`.
3. **Engine options:** `MySQL` (or your lab's engine, e.g. MariaDB) → **Version**: default latest.
4. **Templates:** `Production` (Multi-AZ options only appear reliably under Production; Dev/Test disables them). If staying in free-tier budget, this step documents the Production default — instance size in step 5 can still be small.
5. **Settings** → DB instance identifier: `lab-db-prod`.
6. **Instance configuration:** Burstable class, e.g. `db.t3.micro` (a lab-sized instance; real production would use much larger).
7. **Availability & durability:** Deployment options → **Multi-AZ DB instance** (this is the switch that enables Multi-AZ; the alternate options are Multi-AZ DB cluster and Single DB instance).
8. **Connectivity:**
   - Virtual Private Cloud (VPC): your lab VPC
   - DB subnet group: your lab's DB subnet group (must span ≥2 AZs)
   - Public access: **No** (database stays private, like the lab DB server)
   - VPC security group: your 3306 security group
9. **Authentication:** Master username `admin`, master password of your choice.
10. **Initial database name (optional):** `appdb` — creates the schema automatically.
11. Leave backups enabled (default 7-day retention; Multi-AZ requires automated backups on).
12. Scroll to **Additional configuration** → **Backup** → keep enabled → **Create database**.
13. Wait for status `Available` (can take 5–10 minutes).

**Verify Multi-AZ**

1. **Databases** → select `lab-db-prod`.
2. **Connectivity & security** tab → find the **Availability zone** and **Secondary AZ** — the console now shows the primary AZ and a different secondary AZ (e.g. `us-east-1a` + `us-east-1b`).
3. **Configuration** tab → **Multi-AZ deployment** row shows `Yes` (DB instance) / `Multi-AZ` badge.
4. Confirm the instance has a **hosted zone / CNAME endpoint** — failover moves the DNS target, the endpoint string stays the same.

**Test automatic failover**

1. Select `lab-db-prod` → **Actions** → **Reboot** → **Reboot with failover** → **Reboot**.
2. **Databases** tab: status flips to `Rebooting`, then a **Failover** event appears in the event log (bottom panel / **Events** page).
3. When status returns to `Available`, re-check the **Availability zone** — it has swapped with the secondary AZ.
4. Application impact: a DNS resolution switchover of roughly 60–120 seconds; the endpoint name is unchanged, so no application reconfiguration is needed.

### Tutorial 2 — Read replica

Read replicas are **asynchronous** copies of the primary used to serve read traffic and offload the primary. You create them from the primary with a few clicks.

1. Go to **RDS** → **Databases** → select `lab-db-prod` (the primary from Tutorial 1; a standalone instance works too).
2. **Actions** → **Create read replica**.
3. **Settings** → DB instance identifier: `lab-db-replica-1`.
4. **Instance configuration:** same engine automatically; pick `db.t3.micro` to match the primary.
5. **Connectivity:** same VPC, DB subnet group, and security group as the primary.
6. Leave everything else default → **Create read replica**.

**Verify the replica**

1. **Databases** → both `lab-db-prod` and `lab-db-replica-1` appear. The replica column shows a **Replication role** of `Replica`, and the replica's row lists its **primary** (`lab-db-prod`).
2. **Connectivity & security** tab of the replica → note the **endpoint** — it is a separate DNS name from the primary (applications use it for reads).
3. **Monitoring** tab → **CloudWatch metrics** → check **Replication Lag** (seconds): low/zero = the replica is keeping up; the **BinLog Disk Usage** on the primary feeds it.

**Route reads to the replica**

In your app (e.g. from the web server), use two connections: writes and critical reads → primary endpoint; reports/analytics/high-volume reads → replica endpoint:

```bash
mysql -h <primary-endpoint>   -u admin -p appdb   # writes
mysql -h <replica-endpoint>   -u admin -p appdb   # reads
```

The replica accepts only read statements (`SELECT`); writes to it fail.

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
- **Realistic numbers (on-demand, us-east-1, ~$0.026/hr for db.t3.micro):** single instance ≈ $19/mo; Multi-AZ ≈ $38/mo; one same-region read replica ≈ $19/mo more (≈ $57/mo total with Multi-AZ). Reserved instances cut all of these but the relative shape holds.
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

## Progress

- 2026-08-05: Project created; tutorials and report drafted per the assignment prompt (write-up only, no instances launched).
- 2026-08-05: Scoped to the walkthrough deliverable; report sections marked as Aaron's part with reference notes.

## Review

- Walkthrough deliverable complete: Tutorial 1 (Multi-AZ) and Tutorial 2 (read replica), including verification and failover steps.
- Console steps match the current RDS console flow in us-east-1 (Standard create → Production template → Multi-AZ DB instance → Reboot with failover → Create read replica).
- Report: pending Aaron (reference notes retained in this file).
- No hands-on verification (write-up only by design). If the class requires evidence, the failover + replication-lag verification steps are in the tutorials and can be executed against a real instance.

## Related

- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — the class VPC lab (VPC, subnets, subnet group, security groups) this assignment builds on
- Project: [[2026-08-03-aws-saa-practice-app-scaffold.project.md]] — SAA practice deck; RDS topics are SAA exam material
