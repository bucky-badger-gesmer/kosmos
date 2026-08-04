# Lessons

Lessons learned from corrections — review before starting work.

## 2026-08-03

- **Never infer the exam Domain for SAA questions — always ask.** When adding a practice question via the `saa-question` skill, the user must supply the `Domain:` field (Design Secure / Resilient / High-Performing / Cost-Optimized Architectures). Even when the answer seems obvious from the question content (e.g. a caching question "must" be High-Performing), the user may classify it differently (that caching question was actually Cost-Optimized). Use the domain verbatim when the paste includes one; otherwise ask before creating the file. Rule encoded in `.opencode/skills/saa-question/SKILL.md` (workflow step 2 + completeness check step 4).
