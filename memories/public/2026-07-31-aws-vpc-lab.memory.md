---
title: AWS VPC Lab — Console Walkthrough (Bastion + Web/DB)
description: Explicit click-by-click AWS Management Console walkthrough of the VPC assignment — VPC creation, public/private subnets, IGW, bastion + EIP, NAT gateway, web/DB EC2 instances, route tables, security groups, SSH passthrough, and verification tests
status: in_progress
priority: medium
owner: Aaron
created: 2026-07-31
tags: [aws, vpc, ec2, networking, security-groups, nat-gateway, bastion, ssh, lab]
related_projects: []
---

# AWS VPC Lab — Step-by-Step Console Walkthrough

## Scenario recap

- Website on EC2, customer data on a private backend database.
- Web server and DB server must be in **separate subnets**.
- Network starts at `10.0.0.0`; each subnet = **256 IPv4 addresses** (i.e. `/24`).
- DB server needs **outbound** internet (patches) but must stay unreachable from the internet.

## Architecture

```
Internet
 ├── IGW (Internet Gateway)           → public subnet traffic
 └── NAT Gateway (in public subnet)   → outbound-only internet for private subnet

Public subnet   10.0.1.0/24  →  bastion host, web-server
Private subnet  10.0.2.0/24  →  db-server (outbound via NAT only)
```

- **IGW vs NAT:** IGW allows inbound + outbound. NAT Gateway allows outbound only — the DB can fetch patches but nothing on the internet can connect to it.
- **256 addresses = `/24`.** VPC `10.0.0.0/16`, public `10.0.1.0/24`, private `10.0.2.0/24`. AWS reserves 5 addresses per subnet (network, 3 internal, broadcast) → 251 usable each.
- **Workstation** = your local laptop. It talks to: bastion over SSH (internet), and (later) the DB *through* the bastion.

---

## 0. Prerequisites

1. Sign in to the AWS Management Console → select a region in the top-right (this walkthrough uses **us-east-1 (N. Virginia)**).
2. Create a key pair (one is enough for the lab):
   - Go to **EC2** → left sidebar → **Key Pairs** → **Create key pair**
   - Name: `lab-key` | Type: `RSA` | Private key file format: `.pem` → **Create key pair**
   - Save `lab-key.pem` to `~/.ssh/` and fix permissions:
     ```bash
     chmod 400 ~/.ssh/lab-key.pem
     ```
3. Find your workstation's public IP (you'll need it for the bastion security group):
   ```bash
   curl https://checkip.amazonaws.com
   ```
   → e.g. `203.0.113.7`. You'll use `203.0.113.7/32`.

---

## Task 1 — Creating a VPC

1. Services → **VPC** → left sidebar → **Your VPCs** → **Create VPC**
2. Set these values (leave everything else default):
   | Field | Value |
   |---|---|
   | Resources to create | `VPC only` |
   | Name tag | `lab-vpc` |
   | IPv4 CIDR block | `10.0.0.0/16` |
   | IPv6 CIDR block | `No IPv6 block` |
   | Tenancy | `Default` |
3. Click **Create VPC**.
4. (Optional but good for SSH) Select the VPC → **Actions** → **Edit VPC settings** → check **Enable DNS hostnames** → **Save**.

> Note: AWS's "VPC and more" wizard could build subnets/NAT/IGW for you in one click, but this lab is about doing each piece by hand — use `VPC only`.

---

## Task 1.5 — Internet Gateway (not in the list, but required)

A brand-new VPC has no route to the internet. Create and attach an IGW:

1. Left sidebar → **Internet Gateways** → **Create internet gateway**
   - Name tag: `lab-igw` → **Create internet gateway**
2. Select `lab-igw` → **Actions** → **Attach to VPC**
   - VPC: `lab-vpc` → **Attach internet gateway**

---

## Task 2 — Creating a public subnet

1. Left sidebar → **Subnets** → **Create subnet**
2. Fill in:
   | Field | Value |
   |---|---|
   | VPC ID | `lab-vpc` |
   | Subnet name | `lab-public-subnet` |
   | Availability Zone | `us-east-1a` |
   | IPv4 CIDR block | `10.0.1.0/24` |
3. **Create subnet**.
4. Select `lab-public-subnet` → **Actions** → **Edit subnet settings** → check **Enable auto-assign public IPv4 address** → **Save**.
   (Instances launched here will automatically get a public IP — needed for bastion + web.)

---

## Task 2.5 — Public route table (IGW)

A new VPC's default (main) route table only routes traffic within the VPC. Without a `0.0.0.0/0 → IGW` route, nothing in the public subnet can reach the internet — SSH to the bastion (Task 5) would hang. Do this **before launching any instance**:

1. VPC sidebar → **Route Tables** → **Create route table**
   - Name: `lab-public-rt` | VPC: `lab-vpc` → **Create route table**
2. **Subnet associations** tab → **Edit subnet associations** → check `lab-public-subnet` → **Save associations**
3. **Routes** tab → **Edit routes** → **Add route**:
   - Destination: `0.0.0.0/0` | Target: `Internet Gateway` → select `lab-igw`
   - **Save changes** (the `10.0.0.0/16 → local` route is automatic).

> Route tables do not cascade — every subnet must be explicitly associated with a table that has the routes it needs. The main table stays untouched.

---

## Task 3 — Creating a bastion host

The bastion is a small EC2 instance in the **public** subnet. It is the only way to SSH into the private subnet.

1. Go to **EC2** → **Instances** → **Launch instances**
2. Name: `bastion`
3. Application and OS Images (AMI): **Amazon Linux 2023 AMI** (Free tier eligible)
4. Instance type: `t2.micro` (or `t3.micro`)
5. Key pair: `lab-key`
6. **Network settings** → **Edit**:
   | Field | Value |
   |---|---|
   | VPC | `lab-vpc` |
   | Subnet | `lab-public-subnet` |
   | Auto-assign public IP | `Enable` |
   | Firewall | `Create security group` |
   | Security group name | `bastion-sg` |
   | Description | `SSH access to bastion` |
   | Inbound SG rules | Remove default SSH rule, then **Add security group rule**: Type `SSH`, Source `My IP` (or type your `/32` from step 0) |
7. Storage: default (8 GiB gp3). **Launch instance**.
8. Wait for status `2/2 checks passed` before continuing.

---

## Task 4 — Allocating an Elastic IP for the bastion

A public IP from EC2 changes on every stop/start. An Elastic IP is stable.

1. EC2 left sidebar → **Elastic IPs** → **Allocate Elastic IP address**
   - Public IPv4 address pool: `Amazon's pool of IPv4 addresses` → **Allocate**
2. Select the new EIP → **Actions** → **Associate Elastic IP address**
   - Resource type: `Instance`
   - Instance: `bastion`
   - Private IP: leave the pre-filled one → **Associate**
3. **Write down the EIP** (e.g. `54.82.11.203`) and the bastion's private IP (e.g. `10.0.1.10`) — you'll use both.

---

## Task 5 — Testing the connection to the bastion

From your workstation:

```bash
ssh -i ~/.ssh/lab-key.pem ec2-user@<bastion-EIP>
```

You should get a fingerprint prompt → `yes` → a shell prompt like `[ec2-user@ip-10-0-1-10 ~]$`. Run `exit` to close.

> This only works because Task 2.5 gave the public subnet a route to the internet. If you skipped Task 2.5, go back and do it before testing — otherwise SSH will hang until timeout.

**If it hangs / times out:**

| Symptom | Likely cause | Fix |
|---|---|---|
| Hang until timeout | **No `0.0.0.0/0 → IGW` route in the route table associated with the public subnet** (Task 2.5 — most common cause), or SG doesn't allow your IP, or wrong subnet/SG attached, or IGW missing/not attached | Verify `lab-public-rt` has the IGW route and `lab-public-subnet` is associated with it (Task 2.5); then check `bastion-sg` inbound SSH source; confirm IGW attached (Task 1.5) |
| `Permission denied (publickey)` | Wrong key/user, or key perms | `chmod 400 ~/.ssh/lab-key.pem`; user is `ec2-user` |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Key world-readable | `chmod 400 ~/.ssh/lab-key.pem` |
| "Host key verification failed" | Reused IP from previous instance | `ssh-keygen -R <EIP>` |

---

## Task 6 — Creating a private subnet

1. VPC sidebar → **Subnets** → **Create subnet**
   | Field | Value |
   |---|---|
   | VPC ID | `lab-vpc` |
   | Subnet name | `lab-private-subnet` |
   | Availability Zone | `us-east-1b` |
   | IPv4 CIDR block | `10.0.2.0/24` |
2. **Create subnet**. Do **not** enable auto-assign public IP (it wouldn't matter anyway — no IGW route here).

---

## Task 7 — Creating a NAT gateway

The NAT gateway gives the private subnet outbound-only internet.

1. VPC sidebar → **NAT Gateways** → **Create NAT gateway**
   | Field | Value |
   |---|---|
   | Name | `lab-nat` |
   | Availability mode | **Regional** (highly available across AZs; Zonal is only for pinning to one AZ — not needed here) |
   | Subnet | **`lab-public-subnet`** ← critical, must be the PUBLIC subnet |
   | Connectivity type | `Public` |
   | Elastic IP | click **Allocate Elastic IP** (creates a second EIP automatically) |
2. **Create NAT gateway**. State shows `Pending`, then `Available` after a minute or two.
3. Confirm the NAT's **subnet** column shows `lab-public-subnet`. (A NAT in the private subnet has no internet and silently breaks everything.)

> **Regional NAT gateways (current console) don't show a subnet.** If you chose `Regional` availability mode, the NAT is pinned to no single subnet — the details page shows a **route table** column instead (AWS auto-creates a dedicated route table with `0.0.0.0/0 → IGW` for the NAT's own egress). **Don't panic if you don't see `lab-public-subnet`** — check the NAT's detail view: you should see `lab-nat` → state `Available`, connectivity `Public`, the auto-created EIP, and (in newer consoles) a `Regional` badge / route table entry. What matters for the lab is that the NAT is `Available` with a public EIP; the subnet column only applies to older zonal NATs. (If you ever need the subnet pin, choose `Zonal` mode instead.)

---

## Task 8 — Creating the web server (public subnet)

1. EC2 → **Instances** → **Launch instances**
   - Name: `web-server`
   - AMI: **Amazon Linux 2023** | Type: `t2.micro` | Key pair: `lab-key`
   - Network settings → Edit:
     | Field | Value |
     |---|---|
     | VPC | `lab-vpc` |
     | Subnet | `lab-public-subnet` |
     | Auto-assign public IP | `Enable` |
     | Firewall | `Create security group` |
     | Security group name | `web-sg` |
     | Inbound rules | Remove default SSH; **Add**: Type `HTTP`, Source `Anywhere-IPv4` `0.0.0.0/0` (SSH-from-bastion gets added in Task 10) |
2. **Advanced details** → scroll to **User data** → paste:
   ```bash
   #!/bin/bash
   dnf install -y httpd
   systemctl enable --now httpd
   echo "Hello from web-server" > /var/www/html/index.html
   ```
3. **Launch instance**. Wait for `2/2 checks passed`. Note its private IP (e.g. `10.0.1.20`) and public IP.

---

## Task 9 — Creating the DB server (private subnet)

1. EC2 → **Instances** → **Launch instances**
   - Name: `db-server`
   - AMI: **Amazon Linux 2023** | Type: `t2.micro` | Key pair: `lab-key`
   - Network settings → Edit:
     | Field | Value |
     |---|---|
     | VPC | `lab-vpc` |
     | Subnet | **`lab-private-subnet`** ← the private one |
     | Auto-assign public IP | `Disable` |
     | Firewall | `Create security group` → name `db-sg` (no inbound rules yet — added in Task 10) |
2. **Launch instance**. Wait for checks to pass. **Write down the private IP** (e.g. `10.0.2.10`) — you'll need it.

---

## Task 10 — Route tables and security groups

### 10a. Public route table (IGW) — already done in Task 2.5

The public route table was created in **Task 2.5** so that SSH to the bastion (Task 5) works. Verify it's correct rather than recreating it:
- VPC sidebar → **Route Tables** → select `lab-public-rt`
- **Subnet associations** tab: `lab-public-subnet` listed
- **Routes** tab: `0.0.0.0/0 → lab-igw` present (plus the automatic `10.0.0.0/16 → local`)

### 10b. Private route table (NAT)

1. Route Tables → **Create route table** → Name: `lab-private-rt` | VPC: `lab-vpc` → **Create**
2. Subnet associations tab → **Edit subnet associations** → check `lab-private-subnet` → **Save**
   - **This must be an EXPLICIT subnet association on `lab-private-rt`** — tick `lab-private-subnet` in the "Subnets without explicit associations" list so it moves to this table's "Explicit subnet associations". 
   - **Common mistake:** creating `lab-private-rt` and adding the NAT route, but never associating the subnet — the subnet stays on the main route table (local-only), and the DB silently has no internet (`dnf` times out, exactly like Task 10d's `mariadb105-server` install failing).
   - **Verify:** Route Tables → select `lab-private-rt` → **Subnet associations** tab → `lab-private-subnet` must be listed under **Explicit subnet associations**.
3. Routes tab → **Edit routes** → **Add route**:
   - Destination: `0.0.0.0/0` | Target: `NAT Gateway` → select `lab-nat`
   - **Save changes**.

> The default (main) route table for the VPC stays untouched — both subnets are explicitly associated with their own tables. Route tables do not cascade; each subnet must have its own associations.

### 10c. Security groups

Security groups are **stateful** — if you allow inbound SSH, the return traffic is auto-allowed. Outbound is allow-all by default (fine for this lab).

**Bastion SG (`bastion-sg`)** — should already be right from Task 3; verify:
- EC2 → Security Groups → select `bastion-sg` → **Inbound rules** tab
- Should show one rule: `SSH | TCP 22 | <your-ip>/32`. If it's missing or `0.0.0.0/0`, click **Edit inbound rules** and fix: Type `SSH`, Source `My IP`, **Save rules**.

**Web SG (`web-sg`)** — edit inbound rules to add:
| Type | Port | Source |
|---|---|---|
| HTTP | 80 | `0.0.0.0/0` (anywhere) |
| SSH | 22 | `sg-0xxxxxxxxxxxxxxx` (bastion-sg) ← select "Security group" as source type and pick `bastion-sg` |

**DB SG (`db-sg`)** — edit inbound rules to add:
| Type | Port | Source |
|---|---|---|
| MySQL/Aurora | 3306 | `sg-0xxxxxxxxxxxxxxx` (web-sg) |
| SSH | 22 | `sg-0xxxxxxxxxxxxxxx` (bastion-sg) |

The trick: referencing a **security group ID** instead of an IP means "only traffic coming from instances that carry that SG" — this is exactly how you say "3306 only from the webserver" without knowing its IP.

**Verify attachments:** each instance's Security tab shows the correct SG (bastion→`bastion-sg`, web→`web-sg`, db→`db-sg`). If you attached SGs at launch, they're already correct.

### 10d. DB setup (make it actually serve MySQL)

The assignment's focus is networking, but to prove port 3306 works.

**Where to run these commands:** on the **db-server** itself (not your laptop, not the console). Get there in two SSH hops:

```bash
# from your workstation (Mac/PC) — hop 1: to the bastion
ssh -A -i ~/.ssh/lab-key.pem ec2-user@<bastion-EIP>

# now on the bastion — hop 2: to the db-server
# <db-server-private-ip> = YOUR db-server's private IPv4 (Task 9; e.g. 10.0.2.97, not the example 10.0.2.10)
ssh ec2-user@<db-server-private-ip>
```

You're now on the db-server (`ec2-user@ip-10-0-2-10`). Paste the block below there:

```bash
sudo dnf install -y mariadb105-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation   # answer as you like for a lab

sudo mysql -e "CREATE DATABASE appdb;"
# NOTE: the \! escape below is REQUIRED — bash treats a bare ! inside double quotes
# as history expansion and errors with "event not found". The backslash makes bash
# pass LabPass123! through unchanged. (Alternative: run `set +H` first to disable
# history expansion for the session.)
sudo mysql -e "CREATE USER 'webuser'@'%' IDENTIFIED BY 'LabPass123\!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON appdb.* TO 'webuser'@'%';"

# allow connections on all interfaces (default is localhost only)
sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf.d/mariadb-server.cnf
sudo systemctl restart mariadb
```

**Verify it's serving** (still on db-server):

```bash
sudo systemctl is-active mariadb    # → active
mysql -e "SELECT 1;"                # → returns 1 = server answering
```

> **How to test 3306 from the web-server (no client install needed):** SSH to the web-server (same two-hop pattern, but hop 2 target is the web-server's private IP, e.g. `10.0.1.20` — yours may differ, check EC2 → Instances), then run:
> ```bash
> python3 -c "import socket;s=socket.socket();s.settimeout(4);s.connect(('<db-private-ip>',3306));print('3306 OPEN')"
> ```
> **Read the failure mode** — it tells you exactly what's wrong:
> - `Connection refused` → SG rule **works** (packet arrived), server just isn't listening → check `systemctl is-active mariadb` on db-server
> - **timed out** → SG is blocking (3306 rule missing/wrong source in db-sg) → fix Task 10c
> - prints `3306 OPEN` → DB is serving and the rule allows web→db ✓

---

## Task 11 — Configuring your SSH client for passthrough

You want to run `ssh db-server` from your workstation and have it hop through the bastion automatically (no key ever lives on the bastion).

1. Create/edit `~/.ssh/config` on your workstation:
   > **⚠ The IPs below are EXAMPLES — replace them with YOUR values** (bastion EIP from Task 4, private IPs from Tasks 8/9). Copying the block verbatim is the #1 cause of `ssh bastion` timing out: the example `54.82.11.203` is not a real address on your account. Your values are visible under EC2 → Instances (Public IPv4 for bastion; Private IPv4 for db/web).
   ```ssh-config
   Host bastion
     HostName <bastion-EIP>             # ← YOUR bastion EIP from Task 4 (not the example)
     User ec2-user
     IdentityFile ~/.ssh/lab-key.pem
     ForwardAgent yes

   Host db-server
     HostName <db-private-ip>           # ← YOUR db private IP from Task 9
     User ec2-user
     IdentityFile ~/.ssh/lab-key.pem
     ProxyJump bastion

   Host web-server
     HostName <web-private-ip>          # ← YOUR web private IP from Task 8
     User ec2-user
     IdentityFile ~/.ssh/lab-key.pem
     ProxyJump bastion
   ```
2. `chmod 600 ~/.ssh/config`
3. **How it works:** `ProxyJump bastion` makes your local ssh open a connection to `bastion`, then run the actual SSH session to the target *through* it. `ForwardAgent` lets you re-use your local key agent instead of copying keys. Alternative without config: `ssh -A ec2-user@<EIP>` to the bastion, then `ssh ec2-user@10.0.2.10`.
4. **After any rebuild, clear stale host keys** (`Host key verification failed` means known_hosts has an old key for that IP from a previous instance):
   ```bash
   ssh-keygen -R <bastion-EIP>; ssh-keygen -R <db-private-ip>; ssh-keygen -R <web-private-ip>
   ```

---

## Task 12 — Testing everything

Run these from your workstation unless noted:

```bash
# 1. SSH to the bastion (tests EIP + bastion SG + IGW)
ssh bastion

# 2. From the bastion, SSH into the private DB (tests bastion→private path)
#    <db-private-ip> = YOUR db's private IP (e.g. 10.0.2.97, not the example 10.0.2.10)
ssh ec2-user@<db-private-ip>

# 3. Straight from workstation, via ProxyJump (tests passthrough end-to-end)
ssh db-server

# 4. Web server serves HTTP to the world (from workstation)
curl http://<web-server-public-ip>   # → "Hello from web-server"

# 5. DB can reach the internet (tests NAT) — run on db-server:
sudo dnf update -y                  # succeeds = NAT route + NAT gw working

# 6. DB talks MySQL to web server — install client on web-server, then:
sudo dnf install -y mariadb105
mysql -h 10.0.2.10 -u webuser -p appdb   # "appdb>" prompt = port 3306 SG rule works
```

**Negative tests (prove the security actually works):**

| Attempt | Expected result |
|---|---|
| `ssh ec2-user@<db-ip>` from workstation **without** ProxyJump | timeout — DB has no public IP / route from internet |
| `ssh` directly to web-server from workstation | timeout — web-sg allows SSH only from bastion-sg |
| Browser hitting `<web-public-ip>` on port 22/3306 | connection fails — only HTTP 80 open to the world |
| `curl http://<db-public-ip>` — there is no public IP | n/a — the DB has no public address at all |

**Checklist — assignment requirements vs. what you built:**
- [ ] Web + DB in separate subnets → public `10.0.1.0/24`, private `10.0.2.0/24`
- [ ] Network starts at 10.0.0.0, 256 addresses per subnet → `10.0.0.0/16` VPC, `/24` subnets
- [ ] DB can reach internet for patches → NAT gateway + private route table
- [ ] Web SG: HTTP from Internet, SSH from bastion ✓
- [ ] DB SG: 3306 from web, SSH from bastion ✓
- [ ] Bastion: SSH from your workstation only ✓
- [ ] Private instances reach internet via NAT ✓
- [ ] SSH passthrough through bastion ✓

---

## Gotchas (ranked by how often they bite)

1. **NAT gateway in the private subnet** — has no internet, fails to become Available, and private traffic still dies. Always put NAT in the public subnet.
2. **Route table not associated with the subnet** — each subnet needs its own association; editing the main table only affects unassociated subnets.
3. **IGW never attached to the VPC** — you can create it and forget to attach; public instances stay unreachable.
4. **SG referenced by IP instead of SG ID** — `3306 from 10.0.1.20/32` works until the instance is replaced; `from sg-web` survives replacements and is what the assignment wants.
5. **Key file permissions** — `chmod 400` or SSH refuses to use the key.
6. **MySQL binds to localhost** — without `bind-address = 0.0.0.0`, the web server's 3306 connection is refused even with a perfect SG.
7. **Testing SSH from the wrong source** — the bastion SG must contain *your* current IP; it changes if you switch networks (coffee shop vs home). Check `curl https://checkip.amazonaws.com`.
