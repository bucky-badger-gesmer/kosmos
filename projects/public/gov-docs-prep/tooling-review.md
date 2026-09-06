# Tooling Review — Mantine, Playwright, Datadog, CI/CD, Git

Every tool here is named in the job description under "What You Bring," and **none of them appear in `govdocs-tech-panel-prep.md`.** You don't need deep expertise — you need to speak each fluently enough to say "yes, I've used this / here's how I'd approach it." Cheap points, easy differentiation. If you haven't used one, say so honestly and describe the equivalent you *have* used — coachability is explicitly what they're hiring for.

---

## Mantine (React UI component library)

JD: *"responsive UI frameworks (e.g. Mantine)."* It's a comprehensive React component + hooks library, similar in role to MUI / Chakra.

**Talk fluently about:**
- **Components** — comes with a large set (Button, Table, Modal, Select, DatePicker, Notifications, etc.), so teams build features instead of primitives.
- **`@mantine/form`** — `useForm` hook for controlled forms: `initialValues`, `validate` (per-field validators or a schema), `form.getInputProps('field')` to wire inputs, `form.onSubmit(handler)`. Handles touched/dirty state and error display. This maps straight to the forms section in `react-typescript-review.md`.
- **`@mantine/hooks`** — utility hooks: `useDisclosure` (open/close modals), `useDebouncedValue` (search inputs — relevant to the alert filter in Snippet A), `useMediaQuery` (responsive), `useLocalStorage`.
- **Theming** — `MantineProvider` with a theme object; light/dark support via the color scheme manager. Styling in v7 and v8 is **CSS modules** plus the `classNames` / `styles` props; the old `sx` prop and Emotion were removed in v7 (2023), and v8 (2025) is the current major. If they are on v6 they still have `sx`. Asking "which Mantine version are you on?" is a cheap way to show you know the migration happened.
- **Responsive** — breakpoints, `Grid`/`SimpleGrid`, responsive props. The JD's "responsive UI" emphasis lands here.
- **Accessibility** — components ship with ARIA/keyboard support out of the box (ties to the a11y theme they care about).

**Honest framing if asked directly:** "I've worked with component libraries like [MUI/Chakra/whatever you've used]; Mantine's model — component library plus a hooks package plus `useForm` — is very familiar, and I'd be up to speed quickly." Don't overclaim.

---

## Playwright (end-to-end testing)

JD: *"automated testing frameworks, such as Playwright."* Modern E2E browser testing (Microsoft), the successor-in-spirit to Cypress/Selenium for many teams.

**Talk fluently about:**
- **What it does** — drives a real browser (Chromium/Firefox/WebKit) to test user flows end to end.
- **Auto-waiting** — actions wait for elements to be actionable (visible, enabled, stable). This kills the flaky `sleep()`-everywhere problem of older tools. Big selling point — mention it.
- **Locators** — prefer user-facing, resilient locators: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. Role-based locators double as an accessibility check.
- **Web-first assertions** — `await expect(locator).toBeVisible()` retries until true or times out.
- **Fixtures / test isolation** — each test gets a fresh browser context (isolated cookies/storage).
- **Network mocking** — `page.route()` to stub API responses for deterministic tests.
- **Trace viewer** — records a timeline (DOM snapshots, network, console) for debugging failures — great for CI.
- **Cross-browser + parallel** — runs across browsers and shards in CI.

**The testing pyramid** (know this framing): many fast **unit** tests (Jest/Vitest) → fewer **integration** tests → few **E2E** tests (Playwright) for critical user journeys. E2E is high-value but slow/expensive, so you're selective.

```ts
test('acknowledges an alert', async ({ page }) => {
  await page.goto('/alerts');
  await page.getByRole('button', { name: /acknowledge/i }).first().click();
  await expect(page.getByText(/acknowledged/i)).toBeVisible();
});
```

---

## Datadog (observability & monitoring)

JD: *"observability and monitoring tools (e.g. Datadog)."* Ties directly to the Lambda observability section.

**The three pillars of observability:**
- **Metrics** — numeric time series (latency, error rate, throughput, saturation). Datadog dashboards + monitors/alerts.
- **Logs** — structured, searchable event records. Emit **structured JSON** with a correlation id (see `lambda-aws-review.md`).
- **Traces** — a request's path across services (APM / distributed tracing). Datadog stitches API Gateway → Lambda → Mongo into one trace via a trace id.

**Talk fluently about:**
- **Correlation** — the value of Datadog is connecting a slow trace to the exact logs and the metric spike, in one place.
- **The four golden signals** — latency, traffic, errors, saturation.
- **SLI/SLO** awareness — an SLI is a measured indicator (p99 latency), an SLO is the target you commit to.
- **Alerting on symptoms, not causes** — alert on user-facing error rate / latency, not on CPU. Reduces noise.
- **Dashboards & monitors** — Datadog monitors trigger on thresholds/anomalies; route to Slack/PagerDuty.

If you've used CloudWatch, Grafana, Sentry, or New Relic — say so; the concepts transfer directly.

---

## CI/CD

JD: *"Familiarity with CI/CD pipelines."*

- **CI (Continuous Integration)** — every push/PR triggers automated build + lint + type-check + tests. Catches breakage before merge. Keeps `main` always green.
- **CD (Continuous Delivery/Deployment)** — automated path to staging/prod after CI passes. Delivery = one manual approval to release; Deployment = fully automatic.
- **Typical pipeline stages:** checkout → install → lint + typecheck → unit tests → build → E2E (Playwright) → deploy to staging → smoke test → deploy to prod.
- **Deployment strategies:** blue/green, canary, rolling — reduce blast radius of a bad release. Feature flags to decouple deploy from release.
- **Serverless deploy** — infra-as-code (Serverless Framework, AWS SAM, CDK, or Terraform) so Lambdas/API Gateway are versioned and reproducible.
- Tools you might name: GitHub Actions, GitLab CI, CircleCI, Jenkins.

---

## Git workflows

JD: *"Git-based workflows."*

- **Feature branch + PR** — the standard. Branch off `main`, open a PR, review, CI passes, merge. Never commit straight to `main`.
- **Trunk-based development** — short-lived branches merged frequently to `main`; pairs with feature flags. Contrast with long-lived release branches (GitFlow) — most modern teams favor trunk-based.
- **Merge vs rebase** — merge preserves history with a merge commit; rebase gives linear history but rewrites commits (never rebase shared/pushed branches). Squash-merge for a clean `main`.
- **Good PR hygiene** — small, focused, clear description, tests included. The JD explicitly lists "contribute to code reviews of others," so be ready to describe **how you review**: correctness → security → tests → readability, blocking vs nit, question intent before criticizing (this mirrors the code-review method in the prep doc).
- **Conflict resolution, `git bisect`** (find the commit that introduced a bug), `git revert` vs `git reset` (revert is safe on shared history).

---

## How to handle "have you used X?" honestly

They're hiring for **coachability and growth** — this is stated repeatedly in "Who You Are." The winning move when you *haven't* used a specific tool:

1. Say so plainly — no bluffing.
2. Bridge to the closest thing you *have* used ("I haven't used Datadog, but I've instrumented services with CloudWatch/Sentry, and the metrics/logs/traces model is the same").
3. Show you understand *why* the tool exists.

That sequence demonstrates exactly the self-aware, coachable profile the JD describes — often stronger than a shaky claim of expertise.

---

## Quick self-check questions

1. What makes Playwright's auto-waiting better than manual sleeps? Which locators do you prefer and why?
2. Describe the testing pyramid and where E2E fits.
3. What are the three pillars of observability, and what's the value of correlating them?
4. What are the four golden signals?
5. Walk through a CI/CD pipeline for a React + Lambda app.
6. Merge vs rebase — when each? Why never rebase a shared branch?
7. How do you review someone else's PR?
8. Mantine's `useForm` — how would you wire validation and surface server errors?
