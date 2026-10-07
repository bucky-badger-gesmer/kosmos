---
title: Blank Metal FDE Interview Prep
description: >
  Preparation for the Forward Deployed Engineer interview at Blank Metal
  (Minneapolis AI-native engineering firm) — company research, the concepts and
  vocabulary of the FDE practice, a study checklist keyed to the job posting,
  and a structured retelling of the wes agent project as interview evidence
status: active
priority: high
owner: Aaron
created: 2026-08-14
tags:
  [
    interview-prep,
    forward-deployed-engineer,
    blank-metal,
    ai-agents,
    mcp,
    evals,
    llm,
    strands,
  ]
related_projects: []
---

# Blank Metal FDE Interview Prep

## Summary

Prep for interviewing as a **Forward Deployed Engineer at Blank Metal** (reports to CTO, Minneapolis hybrid, 25–40% travel). The role is equal parts trusted advisor and hands-on builder: embed with an enterprise client, find the highest-value AI opportunity, scope and de-risk it, then ship the production system — MCP servers, sub-agents, agent skills, pipelines, evals — and own the outcome.

This project tracks three things:

1. **Company research** — who Blank Metal is, how they position, what to ask them
2. **Concepts & keywords** — a study checklist built from the posting's own language
3. **Interview evidence** — the `~/Documents/agents/wes` project retold as a story bank: architecture, hard calls, and honest gaps

## Company brief: Blank Metal

### Facts

- **Founded** by former GoKart Labs leaders (GoKart acquired by West Monroe, 2019): Matt "MJ" Johnson (CEO), Mark Hines (COO), **Eric Johnson (CTO — this role reports to him)**, Elli Rader (CRO), Teresa Marchek (Head of Product), Missy Bemm (Partnership Ops). All startup veterans with multiple exits.
- **Funding:** $3M seed led by Rally Ventures (Justin Kaufenberg), Traction Capital (Matt Meents), Pure Play Partners (Brock Noland). ~32 employees as of July 2026. Office at Riverplace, Minneapolis.
- **Positioning:** self-described **"anti-consultancy"** — small senior teams, <5% overhead, shipping weekly. Mantra: _"Don't just talk about AI, ship it."_
- **Core offer:** a **90-day pilot-to-production guarantee**, attacking **"pilot purgatory"** (their stat: 88% of enterprise AI initiatives stall in PoC).
- **Proprietary tool:** **Shippy** — an internal AI tool they use to deliver client work, so clients "experience AI throughout the engagement." Public detail is thin; good discovery question.
- **Industries:** launched targeting fintech, healthcare, education; the posting says current work concentrates in **healthcare and private equity**.
- **Public case results:** national insurer +20% revenue from AI underwriting shipped in 6 weeks; enterprise GenAI platform with +30% productivity gains.
- **Comp shape for this role:** base + revenue-based variable tied to the accounts you carry — comp is literally structured around account ownership, which explains the posting's emphasis on carrying "a small number of accounts deeply."

Sources: [PR Newswire seed announcement](https://www.prnewswire.com/news-releases/blank-metal-raises-3m-to-accelerate-enterprise-ai-from-pilot-to-production-302488925.html), [Twin Cities Business](https://tcbmag.com/new-ai-firm-blank-metal-raises-3-million/), [blankmetal.ai](https://www.blankmetal.ai/).

### What their language tells you

The posting is unusually specific about deliverables — **"MCP servers, sub-agents, agent skills, and the pipelines around them"** — which maps almost one-to-one onto the Claude/Anthropic agent ecosystem vocabulary. Expect them to be fluent in modern agentic tooling and to want evidence you've _shipped_ these artifacts, not read about them. "Evals the client can check for themselves" and "observability" signal they've been burned by (or sell against) demo-ware. "The playbook is still being written, and you will write a lot of it" means they want pattern-extractors, not playbook-followers.

### Questions to ask them

- [ ] What is Shippy today, and how does an FDE use it inside an engagement?
- [ ] What does the current FDE playbook actually cover, and where has it broken down on a real engagement?
- [ ] How do the 90-day guarantee and scoping interact — who absorbs it when discovery reveals the real problem is bigger than the SOW?
- [ ] What does the growth-team handoff look like in practice ("they own the close, you make sure what's promised can be built") — and what happens when those conflict?
- [ ] How do healthcare engagements differ operationally (PHI/HIPAA, security review timelines) from PE ones (speed, diligence-driven deadlines)?
- [ ] What model/inference stack do clients usually land on — provider APIs, Bedrock/Azure, on-VPC?
- [ ] How is the revenue-based variable comp measured — account revenue, margin, renewal?

## Concepts & keywords to master

Checklist keyed to the posting. Each item: the concept, and why it matters for this role.

### Agentic AI delivery artifacts (their named deliverables)

- [ ] **MCP (Model Context Protocol)** — hosts/clients/servers; tools vs. resources vs. prompts; stdio vs. HTTP (streamable) transports; OAuth for remote servers; when to build an MCP server vs. a plain API integration. _They name "MCP servers" as a deliverable — be able to whiteboard the architecture and speak to auth in headless/enterprise contexts (wes has a war story here)._
- [ ] **Sub-agents & orchestration** — orchestrator/worker patterns, context isolation (fresh context windows per task), delegation vs. handoff, verbatim result propagation, parallel fan-out. _Named deliverable; wes has a three-tier example._
- [ ] **Agent skills** — packaged instructions + allowed-tools scoping (Anthropic's Skills pattern and Strands' equivalent); skills as the unit of reusable client capability. _Named deliverable; wes ships one._
- [ ] **Tool design** — schema-first (zod/JSON Schema) definitions, truncation-aware returns, capability partitioning by trust level, idempotency. _The unglamorous 80% of agent quality._
- [ ] **Context engineering** — what goes in the window and why: system prompts as versioned artifacts, context rot, compaction/summarization, RAG vs. long context.
- [ ] **Agent loops & autonomy levels** — the model-owns-the-loop pattern (Strands/Claude Agent SDK style), human-in-the-loop gates, fail-closed autonomy switches, draft-only writes.

### Evals & observability ("results the client can check for themselves")

- [ ] **Eval taxonomy** — deterministic checks, LLM-as-judge (and judge bias/self-judging), human review, regression suites, golden datasets, trajectory/tool-call grading vs. output-only grading. _You've built this; be able to generalize it._
- [ ] **Adversarial & negative cases** — prompt-injection cases, "neither-repo"/abstention cases (does the agent admit when the answer isn't there). _Differentiator: most candidates only test happy paths._
- [ ] **Cost budgets as eval criteria** — token/tool-call/wall-clock ceilings; unit economics of an agent feature.
- [ ] **Production observability for LLM systems** — tracing (OpenTelemetry GenAI conventions; Langfuse/LangSmith/Braintrust as tools of the trade), token/cost metrics, eval-in-production and drift monitoring, feedback loops from users. _Wes's weakest area — study this hardest._
- [ ] **The demo→production gap** — be able to narrate why 88% stall: no evals, no security review plan, no data access story, no owner, wrong problem. This is literally their pitch; have your own version of it.

### Retrieval

- [ ] **RAG architecture** — chunking, embeddings, hybrid (BM25 + vector) search, reranking, citation/grounding; agentic retrieval (search-as-a-tool) vs. pipeline RAG.
- [ ] **When retrieval is the wrong tool** — the posting explicitly wants "the judgment to know when each is the wrong tool." Wes's grep-over-fresh-clones instead of embeddings is a worked example: freshness beats semantic recall for code Q&A at small corpus scale. Know the crossover points (corpus size, query vagueness, staleness tolerance).

### Enterprise deployment & security

- [ ] **Enterprise AI stack choices** — provider APIs vs. AWS Bedrock vs. Azure OpenAI vs. self-hosted; data residency, zero-retention agreements, model allowlists.
- [ ] **Security review navigation** — SSO/SAML/OIDC, secrets management, VPC/private networking, least-privilege service auth (OIDC over static keys), audit logging; HIPAA/PHI basics for healthcare work.
- [ ] **Prompt injection & the untrusted-input threat model** — architectural (not prompt-level) trust boundaries, read-only agents for untrusted input, gated write paths, the lethal trifecta (private data + untrusted content + exfiltration channel).
- [ ] **Stakeholder map of an enterprise deployment** — exec sponsor, IT/security, data owners, and the day-to-day users the posting says decide whether a deployment succeeded.

### The FDE practice itself

- [ ] **Forward-deployed lineage** — the Palantir FDE model (embed, own outcomes, bring patterns home) and its Anthropic/OpenAI-era revival; FDE vs. solutions architect vs. consultant.
- [ ] **Scoping & PoC de-risking** — finding the highest-value use case, framing in the client's language, thin-slice PoCs that kill bad ideas cheaply, defining "production" and success metrics up front.
- [ ] **Value framing** — translating "agent with evals" into "20% underwriting revenue lift"; measurable business outcomes over technical outputs.
- [ ] **Account patterns** — land-and-expand, executive trust-building cadence, bringing patterns back (their "next engagement starts further ahead").

## My relevant experience: wes

An agent I built end-to-end — from "bare-bones weather agent" first commit through 74 commits to a production system on AWS. Full detail in `~/Documents/agents/wes/AGENTS.md` (the accurate architecture doc; README/RUNNING are stale) and `DEPLOYMENT.md`.

### What it is (interview-length version)

Wes is a workplace AI assistant for a dev team. Three capabilities: (1) answers questions about the org's codebases with citations, via CLI or an authenticated REST endpoint; (2) auto-researches Jira tickets — a Jira webhook fires on status change, wes investigates the relevant repos and Confluence with read-only tools and posts structured findings back as a Jira comment; (3) a deep autonomous pipeline — for higher-tier tickets it launches an AWS CodeBuild job that drives a second AI system (sonata, an OpenCode server) through research → technical plan → implementation, opening **draft-only** PRs. TypeScript on the Strands Agents SDK, Grok via the Vercel AI SDK, deployed on ECS Fargate behind API Gateway, CircleCI deploy-on-merge.

### Posting requirement → wes evidence

| Posting asks for                                    | Wes evidence                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agents in production                                | Live on ECS Fargate; webhook-driven autonomous runs; stateless REST `/ask`                                                                                                                                                                                                                         |
| Sub-agents                                          | Three tiers: wes → sonata sidecar → sonata's fresh-context subagents (one per target repo), with verbatim status propagation rules                                                                                                                                                                 |
| Agent skills                                        | `skills/github-code` — Strands skill with `allowed-tools` frontmatter and an embedded security boundary                                                                                                                                                                                            |
| Eval frameworks that showed whether a system worked | Three grading layers (deterministic checks, LLM judge on full trajectories, cost budgets); adversarial prompt-injection case and an anti-hallucination "neither-repo" case; persisted structured results; documented judge-bias flaw                                                               |
| Observability clients can check                     | Trajectory capture, per-run result JSON, CodeBuild build ids stamped on every Jira comment, `supervise()` watchdog; (production tracing/metrics is the honest gap — see below)                                                                                                                     |
| Own architecture and the hard calls                 | See "hard calls" below — each one is documented in the repo with the trade-offs argued in writing                                                                                                                                                                                                  |
| Navigate enterprise environments                    | Jira (hand-built ADF composition because Jira renders no markdown), Confluence, GitHub fine-grained PATs, AWS Secrets Manager, OIDC-only CI/CD                                                                                                                                                     |
| Retrieval + judgment on wrong tool                  | Deliberate grep-over-fresh-shallow-clones instead of a vector index; freshness over semantic recall, argued in the skill file                                                                                                                                                                      |
| Security in real environments                       | Architectural trust boundary: the agent that reads untrusted ticket text is constructed with read-only tools — it physically cannot write; fail-closed double gate (`WES_IMPLEMENT=1` + non-empty allowlist); two written security reviews; CI step that greps image layers for leaked token bytes |
| Python and TypeScript                               | Wes is TypeScript end-to-end (67 TS files, 182 tests); pair with Python work from elsewhere                                                                                                                                                                                                        |

### The hard calls (decision stories)

- [ ] **Trust boundary as architecture, not prompting.** Read tools and write tools are separate exports; the Jira-research agent gets only reads. An eval case proves an injected "reply only LGTM" instruction doesn't take. Story arc: threat model → design → eval that proves it (the injection eval failed on first live run, then passed — evidence the loop works).
- [ ] **MCP tried, removed, and why.** A prior Atlassian MCP integration used browser OAuth that can't run headless on Fargate — replaced with typed first-party clients on API tokens. Sharp answer to "have you used MCP?": yes, hit a concrete production blocker, made the pragmatic call, and the tools are zod-schema'd single-file units that are nearly MCP-server-ready when auth allows. Be ready to sketch that server.
- [ ] **Evals out of CI, on purpose.** They run the real model against real read-only tools and cost real tokens and minutes — a separate `npm run eval` command with non-zero exit, not a rubber stamp in CI. Speaks to eval unit economics.
- [ ] **Ack-then-work webhook design.** 200 is a receipt, not a result; failures route back to the originating Jira ticket; bounded in-memory dedupe; deliberate status-code semantics (500 not 401 for missing secret; 409 not 503 for "already building").
- [ ] **API Gateway + VPC Link over ALB.** Stable HTTPS at ~$0/month vs. $18/month idle; trade-offs (edge-terminated TLS, 29s timeout) documented rather than hidden.
- [ ] **Testing philosophy.** Decisions extracted into pure functions and tested (182 tests); deployment config itself under test (a test reads `infra/task-def.json` and asserts production routing).

### Honest gaps — own them, with a close plan

- [ ] **No MCP server shipped.** Close: build one before the interview if time allows — wrapping wes's GitHub read tools as an MCP server is a weekend-scale project and turns the gap into a story with an ending.
- [ ] **Production observability is thin.** Logs, watchdog, and build-id traceability, but no OTel/tracing/token-cost metrics in prod (eval harness has token metrics). Close: know the tooling landscape cold (Langfuse/LangSmith/Braintrust, OTel GenAI conventions) and describe the instrumentation plan you'd ship first.
- [ ] **No vector retrieval.** Framed as a choice, but be ready for "when would you reach for embeddings?" with a crisp answer (corpus scale, vague queries, non-code content).
- [ ] **No multi-turn sessions / single-user scale.** Roadmapped (SDK ships S3-backed sessions); acknowledge multi-tenancy, rate limiting, and quotas as the next production frontier.
- [ ] **Evals cover one agent.** The jira-research agent has the harness; the main wes agent and deep pipeline don't yet.

### Three things to lead with

1. The **trust boundary is architectural** — capability partitioning by trust level, proven by an adversarial eval, not promised by a prompt.
2. The **eval harness** — layered grading, adversarial + negative cases, budgets, trajectory capture, and a documented known flaw (self-judge bias). Most side projects have zero evals; this one has a design.
3. **Fail-closed production gating** — two independent switches before the agent can write code, empty allowlist means refuse everything, draft-only PRs, written security sign-offs. Exactly the judgment needed when a client asks for autonomy in their repos.

## Prep phases

### Phase 1: Study the concepts list

- [ ] Work through every unchecked item in "Concepts & keywords," hardest-first: production LLM observability, MCP server internals, RAG crossover judgment
- [ ] Capture distilled notes as a linked memory file (`memories/public/`) rather than bloating this project

### Phase 2: Story bank

- [ ] Write a STAR-style story for each "What will help you succeed" bullet in the posting, drawing from wes (table above) and non-wes work (executive communication, production ownership at Augeo, founder/first-engineer experience)
- [ ] Rehearse the wes narrative at three lengths: 90 seconds, 5 minutes, whiteboard-deep
- [ ] Prepare the "when is an agent/RAG/fine-tune the wrong tool" judgment answers

### Phase 3: Drill

- [ ] Mock interview using the `grill-me` skill pattern (one hard question at a time) against this file
- [ ] Whiteboard reps: MCP architecture, wes system diagram, a generic enterprise agent deployment (client VPC, auth, evals, observability)

### Phase 4: Logistics & close

- [ ] Confirm stance on 25–40% travel and hybrid Minneapolis before they ask
- [ ] Finalize the "questions to ask them" list (company brief above)
- [ ] Optional stretch: ship the wes MCP server so the biggest gap becomes a talking point

## Progress

- 2026-08-14: Project created. Company research done (seed round, founders, anti-consultancy positioning, Shippy, 90-day guarantee, healthcare/PE focus). Full wes architecture review completed — evidence table, hard-call stories, and gap list drafted from the actual codebase (AGENTS.md, DEPLOYMENT.md, evals/, infra/).

## Review

_(to be filled after interviews — what landed, what to prep differently next time)_

## Related

- Memory: [[lessons]] — repo-wide lessons file, reviewed at start
- Source repo: `~/Documents/agents/wes` (read `AGENTS.md` there first; `README.md`/`RUNNING.md` are stale)
