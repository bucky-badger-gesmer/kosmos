---
name: saa-question
description: Capture AWS SAA practice questions and append them to the flashcard deck. Use whenever the user pastes a practice question from an exam simulator, textbook, or study site — or says things like "add this question", "here's a question for the deck", "can you add this to my practice questions". Also triggers on phrases like "AWS SAA", "SAA-C03", "cross-account access", or "add to the deck" in a studying context. Even if the user doesn't say "skill", treat pasted exam questions as a request to add them to the deck.
---

# SAA Practice Question Capture

Add AWS SAA practice questions to the app's question deck so they become flashcards. Each question lives in its own markdown file, named by number; a converter script turns them into the typed deck the flashcard app uses.

- Question files: `repositories/aws-saa-practice-app/questions/` — one file per question, named `01.md`, `02.md`, ... (zero-padded, incrementing)
- Converter: run `npm run build:deck` in `repositories/aws-saa-practice-app` after every change — it regenerates `src/data/deck.ts` (ids are derived from the file names: `01.md` → `saa-01`) and validates every question

## Why this format

Questions arrive in all shapes: exam simulators paste "Correct answer" tags inline, textbooks structure them differently, and people describe questions in prose. The deck files use one unambiguous grammar instead, and the converter enforces it — a malformed question fails the build with a file:line error, so bad data can never silently reach the app. Every question also carries an exam `Domain:` (e.g. Design Secure Architectures) so the deck can be practiced by SAA-C03 domain later. One file per question keeps ids stable (they never renumber when questions are added or removed) and keeps git history per-question.

## File grammar (exact)

```markdown
### <prompt — a line or two, up to the first option>

- [ ] <option text — continuation lines must be indented>
  Rationale: <why this option is wrong — optional, indented>
- [x] <correct option — at least one; two [x] = select-multiple question>

Explanation: <overall explanation — may span lines>
Reference: <url — optional; may repeat for multiple references>

Domain: <exam domain, required>
```

Each file contains exactly one question block — no `#` headings.

### Hard rules (the converter rejects violations)

- File name must be a number: `01.md`, `02.md`, ... — the file name becomes the question id (`saa-01`)
- One question block per file
- At least one `[x]` per question, 2–6 options. **Two `[x]` marks a select-multiple question** (e.g. "Select two") — the app then shows toggles + a Submit button and grades by exact set match, so keep the correct answers to the exact set the source intends
- Option bullets are `- [ ]` and `- [x]` only — nothing else on that line
- `Rationale:` and option continuation lines must be indented (any indentation works — editors reformat markdown freely — but two spaces is the house style)
- `Explanation:`, `Reference:`, and `Domain:` start at column 0 (no indent); `Domain:` is required; `Reference:` lines may repeat
- Plain text only inside prompts/options/explanations — no bold, italics, or code formatting (the app renders them literally)
- Prompts must not contain a line that starts with `- [`

## Workflow

1. **Skim the questions directory** so you don't duplicate an existing question and to find the next file number (max number + 1, zero-padded — e.g. if `12.md` is the highest, the new file is `13.md`).
2. **Extract the question** from whatever the user pasted:
   - prompt, options (keep text as close to the source as possible, trimmed of trailing whitespace)
   - the correct answer — if the source marks it ambiguously (e.g. an inline "Correct answer" tag, or a star, or it's just unclear), **ask the user to confirm** instead of guessing
   - per-option rationales when the source provides them (typical sources have an "Incorrect options" breakdown); omit `Rationale:` lines when there is none
   - explanation (from the source's "Overall explanation" / correct-answer rationale)
   - **reference URLs from the "References:" section only** — the source's "via - <url>" line is the source of the answer's screenshot/diagram (usually an image link), not a docs reference, so skip it. Include the via URL only as a fallback when the source has no "References:" section and the via link is a non-image URL. Dedupe and write one `Reference:` line each; omit entirely if there are none
   - the exam **domain** — the official SAA-C03 domains are Design Secure Architectures, Design Resilient Architectures, Design High-Performing Architectures, and Design Cost-Optimized Architectures. **Always ask the user for the domain — never infer or guess it**, even if it seems obvious from the question content. If the source paste includes a domain, use it verbatim.
3. **Strip source artifacts** — remove inline markers like "Correct answer", "(correct)", or numbering prefixes from option text.
4. **Completeness check — ask for anything missing** — before writing anything, confirm every required field is present: prompt, 2–6 options, at least one `[x]`, explanation, and `Domain:`. The domain is the one users most often forget, but the same rule applies to any gap. If the user's paste is missing any required field, list exactly what's missing and ask them to fill it in — never guess and never create the file with gaps. Example prompts: "Which exam domain should this be under (Design Secure Architectures / Resilient / High-Performing / Cost-Optimized)?" or "Can you add the explanation for this one?" or "Which option is the correct answer?" Wait for their reply before proceeding.
5. **Create the file** `questions/<next-number>.md` with the single question block (one blank line between `Reference:` and `Domain:`). Never rewrite existing question files.
6. **Verify** — run the converter from `repositories/aws-saa-practice-app`:
   ```bash
   npm run build:deck
   ```
   If it fails, the error message names the file and line — fix the file and re-run until clean.
7. **Report** — the question added (its id), its domain, and the new deck size (the converter prints the question count).

## Example

**User pastes:** "Which AWS component allows resources in a private subnet to reach the internet for outbound traffic only? NAT Gateway (Correct answer) / Internet Gateway / VPC Peering / Transit Gateway. NAT Gateways enable outbound-only access..."

**You create `questions/03.md`** (if `02.md` is the highest existing):

```markdown
### Which AWS component allows resources in a private subnet to reach the internet for outbound traffic only?

- [x] NAT Gateway
- [ ] Internet Gateway
- [ ] VPC Peering
- [ ] Transit Gateway

Explanation: A NAT Gateway enables outbound-only internet access. An Internet Gateway allows both inbound and outbound traffic, which would expose the private resources.

Reference: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
Reference: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-comparison.html

Domain: Design Secure Architectures
```

## Notes

- If the user asks for anything beyond adding a question (editing, deleting, counting, searching), do it — the same grammar and converter apply, and always re-run `npm run build:deck` afterward.
- Deleting a question = deleting its file; ids of the remaining questions never change. Renaming a file renumbers that question.
