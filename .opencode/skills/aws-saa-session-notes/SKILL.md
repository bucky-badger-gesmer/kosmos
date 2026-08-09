---
name: aws-saa-session-notes
description: Convert cloud computing course-session PDFs (lecture slide decks) into consistent, exam-oriented markdown study notes for AWS Solutions Architect Associate (SAA-C03) preparation. Use this skill whenever the user uploads a course session, lecture deck, class slides, or training PDF about AWS or cloud computing and wants notes, a summary, key points, an outline, or study material from it — even if they don't explicitly say "study notes" or mention the SAA exam. Also use it when the user asks to "run the usual template" on a new session file.
---

# AWS SAA Session Notes

Turn a lecture slide deck (PDF) into one markdown study-notes file that follows a fixed template, so every session in the course produces notes with the same structure and the user can review them consistently while preparing for the AWS Solutions Architect Associate (SAA-C03) exam.

## Why this skill exists

The user is working through a university cloud computing course (slide decks named like "Cloud Computing Session NN <Topic>.pdf") as preparation for the AWS SAA exam. Raw slides are mostly images with sparse bullet text, so the value you add is: extracting the substance, organizing it consistently, filling in the _exam relevance_ the slides leave implicit, and flagging anything the slides state that is outdated relative to current AWS.

## Workflow

1. **Read the entire PDF.** Slide decks are image-heavy; read every page (in ≤20-page chunks) rather than sampling. Section-divider slides (full-bleed photos with a title) mark the deck's structure — use them as your top-level section boundaries.
2. **Extract, don't transcribe.** Merge multi-slide sequences (e.g., "Enable scalability 1 of 2 / 2 of 2", anti-pattern vs. best-practice pairs) into single coherent points. Skip instructor bios, activity placeholders, and "Thank you" slides.
3. **Fill the template** in `references/template.md`. Every section of the template appears in every session's notes, in the same order, even if brief. If a template section genuinely doesn't apply to a session, keep the heading and write one line saying so — consistency is what makes the notes reviewable as a set.
4. **Add SAA exam framing.** For each major concept, ask: _how does the exam test this?_ The SAA exam tests scenario-based decision-making (e.g., "which is the MOST cost-effective..."), not recall of slide bullets. Draw exam tips from well-known SAA themes: cost optimization levers, high availability across AZs, Regions vs. AZs vs. edge locations, managed vs. self-managed tradeoffs, the shared responsibility model, and the Well-Architected pillars.
5. **Flag outdated content.** Academic decks age. If a slide states something no longer true of AWS (e.g., old Free Tier terms, "S3 was launched in...", service names that have changed, an outdated CEO), note it in the "Watch out" section rather than silently repeating it. Verify with a web search when unsure.
6. **Name the output** `SessionNN-<short-topic>-notes.md` (e.g., `Session01-cloud-intro-notes.md`) and deliver the file to the user.

## Style rules for the notes

- Write definitions exactly the way the exam expects them worded (e.g., cloud computing = "on-demand delivery of IT resources via the internet with pay-as-you-go pricing").
- Bold the term being defined, not whole sentences.
- Prefer compact tables for anything comparative (service models, pricing options, Region vs. AZ vs. edge).
- Keep it to roughly 2–5 pages of markdown. These are review notes, not a textbook: every line should earn its place.
- Self-check questions go last and should be scenario-style where possible (like real SAA questions), with answers in a collapsed `<details>` block so the user can quiz themselves.

## Template

The full template with per-section guidance lives in `references/template.md`. Read it before writing the notes.
