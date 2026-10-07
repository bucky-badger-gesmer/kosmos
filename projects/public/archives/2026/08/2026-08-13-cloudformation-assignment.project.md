---
title: CloudFormation Assignment — Update lab-network & lab-application Templates
description: >
  SEIS 615 assignment: re-implement the VPC lab as infrastructure-as-code by updating the in-class lab-network and lab-application CloudFormation templates — one public + one private subnet, bastion host in public, NAT gateway in public, private EC2 instance, and route-table/security-group wiring (private SSH only from bastion, bastion SSH only from workstation, private outbound via NAT). Deliverables: a Canvas report, the two updated .yaml templates, working templates, and cited references.
status: planning
priority: high
owner: Aaron
created: 2026-08-13
tags:
  [
    aws,
    cloudformation,
    iac,
    vpc,
    subnet,
    nat-gateway,
    bastion,
    security-groups,
    route-tables,
    assignment,
  ]
related_projects:
  [
    2026-07-31-aws-vpc-lab.memory.md,
    2026-08-09-elasticity-availability-lab.project.md,
  ]
---

# CloudFormation Assignment — Update lab-network & lab-application Templates

## Summary

Re-implement the earlier VPC lab (`memories/public/2026-07-31-aws-vpc-lab.memory.md`) as **infrastructure as code**: the in-class `lab-network.yaml` and `lab-application.yaml` CloudFormation templates, updated to build the assignment architecture declaratively instead of clicking through the console. Deliverable: the pair of working templates plus a Canvas report.

**The finished templates are done and live in the class repo:**

- `repositories/cloud-computing-notes/labs/cloudformation/lab-network.yaml`
- `repositories/cloud-computing-notes/labs/cloudformation/lab-application.yaml`

(The unmodified class originals remain in `~/Downloads/` for reference. What changed and why is in [Template changes explained](#template-changes-explained) — the raw material for the report.)

**Architecture** (same topology as the July console lab, now expressed in YAML):

```
Internet
 ├── Internet Gateway (IGW) ─────→ public subnet (bastion)
 └── NAT Gateway (in public subnet) ──→ outbound-only internet for the private subnet

Public subnet   10.0.0.0/24  →  bastion host (SSH from workstation only)
Private subnet  10.0.1.0/24  →  private server (SSH from bastion only; internet via NAT)
```

## Requirements

- [ ] One **public subnet** and one **private subnet** (VPC `10.0.0.0/16`, public `10.0.0.0/24` — unchanged from the class template, private `10.0.1.0/24`)
- [ ] **Bastion host** (EC2) in the public subnet
- [ ] **NAT gateway** in the public subnet (with its Elastic IP)
- [ ] **EC2 instance** in the private subnet
- [ ] **Route tables** wired: public `0.0.0.0/0 → IGW`, private `0.0.0.0/0 → NAT`, each associated with its subnet
- [ ] **Private server SG** accepts SSH only from the **bastion**
- [ ] **Bastion SG** accepts SSH only from **your workstation**
- [ ] **Private server reaches the Internet via the NAT gateway** (outbound egress works)
- [ ] **Deliverables:** Canvas report + updated `lab-network.yaml` + `lab-application.yaml` + citations (templates verified working)

## Runbook — from an empty AWS account to a finished assignment

> **How this works — nothing in AWS is created by hand.** In the July console lab you built each resource with clicks (create VPC → create subnet → launch bastion…). Here the two YAML files *describe* all of those resources, and the two **Create stack** uploads (Steps 4–5) make CloudFormation build everything automatically. You start from a completely empty account:
>
> | What the console lab built by hand | Now created automatically by |
> |---|---|
> | VPC, IGW, subnets, route tables, NAT gateway + EIP | `lab-network.yaml` → Step 4 **Create stack** |
> | Bastion host, private server, security groups | `lab-application.yaml` → Step 5 **Create stack** |
>
> The only things you make yourself are a key pair (Step 2) and screenshots. 📸 marks every screenshot the report needs.
>
> **Clean slate confirmed:** the July console lab was fully torn down, so the account starts empty — exactly what this runbook assumes. **Nothing bills until Step 4**, and Step 7 removes everything billable.
>
> 💰 **Cost while the lab is up:** two t2.micro instances (~$0.023/hr, free if free-tier), NAT gateway (~$0.045/hr + $0.045/GB), two public IPv4 addresses (~$0.01/hr) — roughly **$0.08/hr, so an afternoon session costs well under $1**. The scary ~$32/mo NAT figure only applies if you forget Step 7.

### Step 1 — Sign in

1. Sign in to the AWS Management Console (same login you used for the July lab).
2. Top-right region picker → **US East (N. Virginia) us-east-1**. Everything below happens in this region.

### Step 2 — Create the SSH key pair

1. Console search bar → **EC2** → left sidebar **Network & Security → Key Pairs** → **Create key pair**.
2. Fill in: Name `lab-key` | Key pair type `RSA` | Private key file format `.pem` → **Create key pair**. The browser downloads `lab-key.pem`.
3. In your terminal:

   ```bash
   mv ~/Downloads/lab-key.pem ~/.ssh/
   chmod 400 ~/.ssh/lab-key.pem
   ```

> Key pairs may or may not have survived the July teardown (deleting instances doesn't delete key pairs, but a manual cleanup might have). If the console still lists `lab-key` **and** you still have `~/.ssh/lab-key.pem`, skip creation. If it's listed but you don't have the `.pem`, delete it (select → **Actions → Delete**) and create a fresh one — a private key can never be re-downloaded. Key pairs themselves cost nothing.

### Step 3 — Get your workstation's public IP

```bash
curl https://checkip.amazonaws.com
```

Note the result — you'll enter it in Step 5 as `<that-ip>/32` (e.g. `203.0.113.7/32`).

### Step 4 — Deploy the network stack (creates the VPC, subnets, IGW, NAT, route tables)

1. Console search bar → **CloudFormation** → **Create stack** → **With new resources (standard)**.
2. On *Create stack*:
   | Field | Value |
   |---|---|
   | Prepare template | `Choose an existing template` |
   | Specify template | `Upload a template file` → **Choose file** → `repositories/cloud-computing-notes/labs/cloudformation/lab-network.yaml` |
   → **Next**. (The upload auto-creates a small `cf-templates-…` S3 bucket in your account — harmless, a few KB.)
3. On *Specify stack details*: Stack name = **`lab-network`** — exactly this, the application stack looks for it by name. No parameters appear (this template has none) → **Next**.
4. On *Configure stack options*: leave every default → **Next**.
5. On *Review and create*: scroll to the bottom → **Submit**.
6. You land on the stack page. Open the **Events** tab and click refresh (⟳): each resource goes `CREATE_IN_PROGRESS` → `CREATE_COMPLETE`. The **NAT gateway is the slow one (~2 min)**; the whole stack takes ~2–3 min. Done when the status at the top reads `CREATE_COMPLETE`.
7. 📸 Screenshot the **Events** list (evidence the template works) and the **Outputs** tab — it should show three rows (`PublicSubnet`, `PrivateSubnet`, `VPC`) with export names `lab-network-SubnetID`, `lab-network-PrivateSubnetID`, `lab-network-VPCID`.

### Step 5 — Deploy the application stack (creates the bastion, private server, security groups)

1. **Stacks** (breadcrumb top-left) → **Create stack** → **With new resources (standard)** → upload `repositories/cloud-computing-notes/labs/cloudformation/lab-application.yaml` → **Next**.
2. On *Specify stack details*: Stack name = `lab-application`, then the parameters:
   | Parameter | Value |
   |---|---|
   | `AmazonLinuxAMIID` | leave the default (resolves to the latest Amazon Linux 2 AMI at deploy) |
   | `KeyPairName` | `lab-key` (pick from the dropdown) |
   | `MyIp` | your Step 3 result + `/32`, e.g. `203.0.113.7/32` |
   | `NetworkStackName` | leave `lab-network` |
   → **Next** → leave stack-option defaults → **Next** → **Submit**.
3. **Events** tab: after the bastion completes, `WebServerInstance` sits in `CREATE_IN_PROGRESS` — it is waiting for its cfn-signal to travel **through the NAT gateway**. Total ~3–5 min. `CREATE_COMPLETE` therefore *is itself proof that NAT egress works* (mention this in the report).
4. 📸 Screenshot the **Events** list and the **Outputs** tab, and copy the two outputs — **`BastionPublicIp`** and **`PrivateServerPrivateIp`** — for Step 6.

> **If the stack rolls back** after ~5 minutes with `Failed to receive 1 resource signal` on `WebServerInstance`: the private server couldn't reach the internet — a NAT/private-route problem in the network stack. Fix `lab-network.yaml`, update that stack, delete and re-create `lab-application`.

### Step 6 — Verify from your terminal

Run these locally. `<bastion-ip>` = `BastionPublicIp`, `<private-ip>` = `PrivateServerPrivateIp` (both from Step 5). The AMI is Amazon Linux 2, so package commands use `yum`.

```bash
# 1. SSH to the bastion (tests public IP + bastion SG + IGW route)
ssh -i ~/.ssh/lab-key.pem ec2-user@<bastion-ip>

# 2. From your workstation, jump through the bastion to the private server
#    (tests the private SG's bastion-only rule)
ssh-add ~/.ssh/lab-key.pem        # once — puts the key in the agent so BOTH hops use it
ssh -J ec2-user@<bastion-ip> ec2-user@<private-ip>

# 3. On the private server — reach the internet via NAT (tests the private route table + NAT)
sudo yum check-update     # exit 0 or 100 (updates listed) = NAT egress working; read-only
```

📸 Capture the terminal output of all three (plus the negative tests below) for the report.

> Why `ssh-add` is needed: with `-J`, command-line `-i` applies **only to the final target**, not the jump host — so `ssh -i … -J …` sends your default keys to the bastion and fails with `Permission denied (publickey)`. Loading the key into the agent makes it available to both hops.

**If SSH misbehaves:**

| Symptom | Likely cause | Fix |
|---|---|---|
| Hang until timeout | Bastion SG doesn't allow your IP (did it change?), or IGW route problem | Re-check `MyIp` vs current `curl https://checkip.amazonaws.com`; verify the public route table in the network stack |
| `Permission denied (publickey)` | `-i` not applied to the `-J` jump host (or wrong key/user/perms) | `ssh-add ~/.ssh/lab-key.pem` then `-J` (no `-i`); user is `ec2-user`; `chmod 400 ~/.ssh/lab-key.pem` |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Key world-readable | `chmod 400 ~/.ssh/lab-key.pem` |
| `Host key verification failed` | IP reused from a previous instance | `ssh-keygen -R <bastion-ip>` |

**Negative tests (prove the security is real):**

| Attempt | Expected result |
|---|---|
| `ssh ec2-user@<private-ip>` from workstation (no jump) | timeout — private server has no public IP/route |
| `curl http://<private-ip>` from the bastion | timeout — the private SG blocks HTTP (SSH-only) |
| `ssh ec2-user@<bastion-ip>` from a different network (e.g. phone hotspot; optional) | timeout — bastion SG allows only `MyIp` |

**✅ Verify checklist:**

- [ ] Bastion SSH works from workstation
- [ ] Bastion → private server SSH works (via `-J`)
- [ ] Private server rejects HTTP from the bastion (SSH-only)
- [ ] Private server `yum check-update` succeeds (NAT egress proven)
- [ ] Negative tests fail as expected

### Step 7 — Tear down (stop the billing)

> Application stack first — CloudFormation refuses to delete a stack whose exports are still in use.

1. CloudFormation → **Stacks** → select `lab-application` → **Delete** → confirm **Delete**. Wait for `DELETE_COMPLETE` (take any remaining screenshots *before* this).
2. Select `lab-network` → **Delete** → confirm. The NAT gateway is again the slow part (~1–2 min); this also releases the Elastic IP and removes the subnets, IGW, and route tables.
3. Verify the cleanup: EC2 → **Instances** (both `terminated`), VPC → **NAT gateways** (deleted), EC2 → **Elastic IPs** (empty list). If a stack shows `DELETE_FAILED`, its Events tab names the blocking resource.
4. ⚠️ **Billing:** an idle Elastic IP is ~$3.60/mo and a NAT gateway ~$32/mo + data — tear down promptly after the screenshots are captured.

### Step 8 — Write the report (Canvas)

- [ ] Narrative: the two-template split, the exported/imported values (`${AWS::StackName}-…` exports, `NetworkStackName` parameter), and each of the 8 requirements mapped to a template resource — the mapping table below is ready to adapt
- [ ] Call out that the private server's `CreationPolicy`/cfn-signal doubles as an automated NAT-egress test
- [ ] Screenshots from Steps 4–6 (stack events, outputs, verify terminal output)
- [ ] **Citations** — AWS CloudFormation docs (Resources, Outputs/Export, `Fn::ImportValue`, `AWS::SSM::Parameter`, cfn-init/cfn-signal helper scripts + `CreationPolicy`), VPC/EC2 docs for the resources used, and the in-class session slides

## Template changes explained

Reference for the report — what differs from the class originals (in `~/Downloads/`) and why.

**Requirement → resource mapping:**

| Requirement | Satisfied by | Template |
|---|---|---|
| Public subnet | `PublicSubnet` `10.0.0.0/24` (class original, unchanged) | lab-network |
| Private subnet | `PrivateSubnet` `10.0.1.0/24` (added) | lab-network |
| NAT gateway in public subnet + EIP | `NatGateway` + `NatElasticIp` (added) | lab-network |
| Route tables wired | `PublicRoute → IGW` (original); `PrivateRoute → NAT` + association (added) | lab-network |
| Bastion in public subnet | `BastionHost` (added) | lab-application |
| EC2 in private subnet | `WebServerInstance` moved to the private subnet | lab-application |
| Bastion SG: SSH from workstation only | `BastionSecurityGroup` ingress `22 ← MyIp` (added) | lab-application |
| Private SG: SSH from bastion only | `WebServerSecurityGroup` ingress `22 ← BastionSecurityGroup` (SG-to-SG reference) | lab-application |
| Private internet via NAT | `PrivateRoute` + default-allow egress; proven by cfn-signal and `yum check-update` | both |

**`lab-network.yaml` — added the private half** (everything original kept byte-for-byte):

- `PrivateSubnet` `10.0.1.0/24` in the **same AZ** as the public subnet — the NAT lives there, and a different AZ would push all private egress cross-AZ (extra data-transfer cost).
- `NatElasticIp` with `DependsOn: VPCGatewayAttachment` — AWS requires a VPC EIP defined alongside the IGW attachment to depend on it, or stack creation can race.
- `NatGateway` in `PublicSubnet` — a NAT in the private subnet would have no internet itself.
- `PrivateRouteTable` / `PrivateRoute` (`0.0.0.0/0 → NAT`) / subnet association. No `DependsOn` needed — the NAT is a plain resource, not an attachment.
- `PrivateSubnetNetworkAclAssociation` — mirrors the template's explicit NACL style for the public subnet.
- New output exporting the private subnet as `${AWS::StackName}-PrivateSubnetID`, matching the existing export convention. The original `VPC`/`PublicSubnet` outputs are untouched — the application stack imports those exact names.

**`lab-application.yaml` — bastion added, web server repurposed as the private server:**

- New parameters `KeyPairName` + `MyIp` — the class file had no SSH access at all; parameterizing keeps the template reusable (no hardcoded IPs/keys). `AmazonLinuxAMIID` (SSM parameter, Session08 best practice) and `NetworkStackName` kept as-is.
- New `BastionSecurityGroup` (SSH 22 from `MyIp` only) and `BastionHost` (t2.micro in the public subnet; public IP via the NIC's `AssociatePublicIpAddress: true`, the template's existing pattern).
- `WebServerInstance` moved to the private subnet with three edits: `KeyName` added, `AssociatePublicIpAddress` → `false`, NIC subnet import → `${NetworkStackName}-PrivateSubnetID`. Its cfn-init/cfn-signal `CreationPolicy` was kept **deliberately**: installing httpd and signaling CloudFormation both need internet, so from the private subnet the stack only completes if the NAT path works — a built-in verification.
- `WebServerSecurityGroup` ingress rewired to be SSH-only: `22 ← BastionSecurityGroup` (SG-to-SG reference — "only traffic from instances carrying the bastion SG"). The original's `80 ← 10.0.0.0/16` rule was **removed** to match the assignment's "only accept SSH traffic from the bastion."
- `DiskVolume` + `DiskMountPoint` **deleted** — not part of the assignment, 100 GB of paid gp2, and its `DeletionPolicy: Snapshot` would have left a paid snapshot behind after teardown.
- `URL` output replaced by `BastionPublicIp` + `PrivateServerPrivateIp` (the server no longer has a public DNS name).

## Progress

- 2026-08-13: Project created from `Assignment – CloudFormation.pdf` (2 pages: assignment brief + deliverables). Six phases drafted, written generically pending the actual in-class templates.
- 2026-08-13: Reviewed, then adapted to the actual class templates (`~/Downloads/lab-network.yaml`, `lab-application.yaml`): kept public `10.0.0.0/24` + added private `10.0.1.0/24` (same AZ); stack-name-prefixed exports (`-PrivateSubnetID` added); AL2 → `yum`; web server repurposed as the private server (cfn-signal doubles as NAT test); `KeyPairName`/`MyIp` parameters + bastion added; 100 GB `DiskVolume` dropped; verify uses SSH ProxyJump.
- 2026-08-13: Restructured for a from-scratch run: wrote the **finished templates** to `repositories/cloud-computing-notes/labs/cloudformation/` (both parse-checked; original class files untouched in Downloads) and replaced the phase-based plan with a linear 8-step **Runbook** that assumes an empty AWS account — sign-in → key pair → IP → two stack deploys (full console clicks) → verify → teardown → report, with 📸 screenshot markers. YAML explanations moved to a "Template changes explained" reference section with a requirement→resource mapping table.

## Review

- Assignment requirements fully mapped: 8 checkable items → runbook steps + the requirement→resource table (subnets, bastion, NAT, private EC2, route tables, SG isolation, NAT egress, deliverables).
- Cross-stack linkage keeps the class convention: `${AWS::StackName}-*` exports + `Fn::ImportValue: !Sub ${NetworkStackName}-*`, network stack deployed first under the name `lab-network`.
- Best practices from Session08 notes: SSM AMI parameter kept (no hardcoded `ImageId`), parameterized key pair + workstation IP, SG-to-SG reference for the bastion→private SSH rule.
- Minimal-diff approach: every class resource kept where possible; the repurposed web server's `CreationPolicy`/cfn-signal doubles as an automated NAT-egress test worth calling out in the report.

## Related

- Templates: `repositories/cloud-computing-notes/labs/cloudformation/` — the finished `lab-network.yaml` + `lab-application.yaml` (class originals in `~/Downloads/`)
- Memory: [[2026-07-31-aws-vpc-lab.memory.md]] — the console VPC lab this assignment re-implements as IaC (bastion + NAT + SG patterns)
- Notes: `repositories/cloud-computing-notes/notes/Session08-automation-notes.md` — CloudFormation templates/stacks, parameters, Outputs/Exports, SSM AMI parameter
- Project: [[2026-08-09-elasticity-availability-lab.project.md]] — earlier assignment; shares the bastion/NAT/SG networking patterns
