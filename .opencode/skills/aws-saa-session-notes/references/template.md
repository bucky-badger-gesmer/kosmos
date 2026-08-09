# Study-Notes Template

Every session's notes use exactly this structure, in this order. Guidance for each section is in the blockquotes — do not include the blockquotes in the output.

---

# Session NN — <Topic Title>

> One-line header block: source file name, date generated, and the SAA-C03 exam domains this session touches (Domain 1: Design Secure Architectures, Domain 2: Design Resilient Architectures, Domain 3: Design High-Performing Architectures, Domain 4: Design Cost-Optimized Architectures).

**Source:** <pdf filename> · **SAA domains:** <list> · **Generated:** <date>

## 1. Big picture (30-second summary)

> 3–5 sentences of prose. What this session covers and why it matters for the exam. A student should be able to read only this section the night before the exam.

## 2. Key terms & definitions

> A table: Term | Definition (exam-accurate wording) | Why it matters. Include every bolded/highlighted term from the deck. This is the section to be most complete in — definition questions are free points.

## 3. Core concepts

> The body. One `###` subsection per major topic of the deck (follow the deck's section-divider slides). Use short bullets, comparison tables, and merge anti-pattern/best-practice slide pairs into "do this, not that" lines. Include concrete numbers the deck gives (e.g., "save up to 75% with RIs", "a data center has 50,000–80,000 servers") — the exam likes them.

## 4. AWS services mentioned

> A table: Service | Category | One-line purpose | Session context. Only services actually named in the deck. This builds a running service glossary across sessions.

## 5. Exam tips & likely question angles

> 4–8 bullets. How the SAA exam actually tests this material: common distractors, "MOST cost-effective / MOST highly available" framings, easily confused pairs (Region vs. AZ, elasticity vs. scalability, IaaS vs. PaaS). Be specific, not generic.

## 6. Watch out (corrections & updates)

> Anything in the deck that is outdated, oversimplified, or stated differently from current AWS documentation — with the current correct version. If nothing, say "Nothing flagged in this session."

## 7. Self-check questions

> 5–8 questions. Mostly scenario-style multiple choice (4 options, one correct) mimicking real SAA questions, plus a couple of quick recall questions. Put all answers with one-line explanations inside a single `<details><summary>Answers</summary>...</details>` block at the end so the user can self-quiz.
