# Front-End and Web Fundamentals — CSS, Browser, Security, Testing, TS Extras

The other files cover React, TypeScript, async, and HTTP. This fills the remaining "basic tech questions" a front-end-first panel tends to ask: CSS, how the browser works, web security beyond XSS, testing philosophy, and a few TypeScript details. Skim once; most of this you already know and just need fresh.

---

## CSS

- **Box model.** `content-box` (default) adds padding and border to `width`; `border-box` includes them. Nearly everyone sets `* { box-sizing: border-box }` globally. Say why: predictable widths.
- **Flexbox vs Grid.** Flex is one-dimensional (a row or a column) and content-driven. Grid is two-dimensional and layout-driven. Toolbar, nav, button row: flex. Page layout, dashboard cards, a form with aligned labels: grid. They are complementary, not competitors.
- **Specificity.** Inline > id > class/attribute/pseudo-class > element. `!important` overrides all and is a smell. CSS Modules sidestep specificity fights by scoping class names, which is why Mantine v7 moved to them.
- **Responsive units.** `rem` for type and spacing (respects user font-size settings, an accessibility point), `%`/`fr`/`minmax()` for layout, `vh`/`vw` sparingly (mobile browser chrome makes `100vh` lie; `dvh` fixes it). Breakpoints in `min-width` media queries, mobile-first.
- **Positioning.** `relative` is the anchor for `absolute` children; `fixed` is viewport-relative; `sticky` toggles between relative and fixed at a scroll threshold (table headers).
- **Stacking.** `z-index` only works on positioned elements and only within its stacking context. "My modal is behind the header" is almost always a stacking-context problem, not a z-index number problem.
- **CSS-in-JS vs CSS Modules.** Runtime CSS-in-JS (Emotion, styled-components) costs render time and does not play well with server components; the ecosystem, Mantine included, has moved to build-time approaches: CSS Modules, vanilla-extract, Tailwind.

---

## How the browser renders

- **Critical rendering path.** HTML → DOM; CSS → CSSOM; combined → render tree → layout (geometry) → paint → composite. JS blocks parsing unless `defer`/`async`.
- **Reflow vs repaint.** Changing geometry (width, font-size) forces layout for the subtree, expensive. Changing color only repaints. Animating `transform` and `opacity` is cheap because it can stay on the compositor.
- **Why React batches.** Every DOM write can trigger layout. React batches state updates and commits once per render, which is the practical reason the virtual DOM exists.
- **Event delegation.** One listener on a parent handles events from many children via bubbling. React does this at the root for you. Relevant if asked why `e.stopPropagation()` in React does not stop native listeners the way you expect.
- **Debounce vs throttle.** Debounce waits for quiet (search box). Throttle fires at most once per interval (scroll, resize). Code in `coding-warmups.md`.
- **Storage.** `localStorage` (persistent, per origin, JS-readable, ~5 MB), `sessionStorage` (per tab), cookies (sent with every request, can be `httpOnly`), IndexedDB (structured, async, large). Tokens do not belong in `localStorage`.

---

## Web security beyond XSS

Snippet A covers XSS. Be able to say the rest in one line each.

- **CSRF.** A malicious site makes the user's browser send a request to yours with their cookie attached. Defenses: `SameSite=Lax` or `Strict` cookies (the modern default does most of the work), anti-CSRF tokens, checking `Origin`. Bearer tokens in an `Authorization` header are not vulnerable because the attacker's page cannot set that header.
- **The cookie vs token tradeoff, said cleanly.** `httpOnly` cookie: immune to XSS theft, needs CSRF defense. Bearer token in memory: immune to CSRF, exposed if there is an XSS hole. Most teams pick httpOnly + SameSite and accept the CSRF work.
- **CORS is not a security feature for your server.** It is a browser rule protecting the user. Your API still needs auth on every request. Preflight happens for non-simple requests (custom headers such as `Authorization`, JSON `Content-Type`, methods other than GET/POST/HEAD).
- **CSP.** A response header allowing scripts only from listed origins; the strongest XSS mitigation after not rendering untrusted HTML.
- **IDOR** is the backend twin of all this. Covered in Snippet B: authorize on the server using the verified identity, never trust an id in the URL.
- **Dependency supply chain.** Lockfiles, `npm audit`, Dependabot or Renovate in CI. One sentence is enough.

---

## Testing philosophy (they will ask "how do you test")

- **React Testing Library.** Test behavior, not implementation. Query by role and label the way a user would (`getByRole('button', { name: /acknowledge/i })`), not by class or component internals. If a refactor that does not change behavior breaks the test, the test was wrong.
- **Mocking the network.** MSW (Mock Service Worker) intercepts `fetch` at the network layer, so the component code runs unmodified. Better than mocking `fetch` by hand or mocking your own API module.
- **What to unit test.** Pure functions: filter builders, formatters, reducers, selectors. Cheap, fast, many.
- **What to E2E test.** The three to five journeys that would page someone if broken. Playwright, `getByRole`, `page.route` to stub the API so the test is deterministic. Few, slow, valuable.
- **Testing a Lambda.** Unit test the handler with a mocked data layer (inject the `db` rather than importing a global) and assert status codes: 404 on unknown customer, 401 with no tenant, 200 with the right shape. Integration test against a local Mongo in CI for the query itself.
- **Flaky tests.** Almost always timing or shared state. Playwright's auto-waiting fixes the first; fresh browser context per test fixes the second. Never fix a flaky test with a `sleep`.
- **Coverage.** A number that tells you what is untested, not what is well tested. Say you look at it for gaps, not as a target.

---

## TypeScript details not in the other files

- **`strict` and `strictNullChecks`.** With strict on, `string | undefined` is not assignable to `string`. Most "TS is annoying" complaints are strictNullChecks catching a real bug.
- **Narrowing.** `typeof x === 'string'`, `'rate' in x`, `x instanceof Error`, `Array.isArray(x)`, and user-defined type guards (`function isAlert(x: unknown): x is Alert`). Discriminated unions are narrowing by a literal field.
- **`satisfies`.** Checks a value against a type without widening it: `const routes = { home: '/' } satisfies Record<string, string>` keeps `routes.home` typed as the literal. Nice for config objects.
- **`readonly` and `as const`.** `as const` makes an array or object literal deeply readonly with literal types; it is how you derive a union from a list: `const STATUSES = ['compliant', 'action_required'] as const; type Status = typeof STATUSES[number]`.
- **Enums vs string literal unions.** Prefer unions. Enums generate runtime code, numeric enums are unsafe, and unions play better with JSON from an API.
- **Generics constraints.** `<T extends { id: string }>` lets a helper work on any entity with an id. Say a real one: a typed `useFetch<T>` or a repository `findById<T>`.
- **Typing React events.** `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`, `React.MouseEvent<HTMLButtonElement>`. Knowing these cold saves fumbling on a whiteboard.

---

## React 18 and 19 you should be able to name

Not deep, just fluent.

- **React 18.** Automatic batching everywhere, concurrent rendering, `useTransition` for non-urgent updates (keep typing responsive while a heavy list re-renders), `useId` for accessible label ids, Suspense for data with a compatible library.
- **React 19.** `ref` is a regular prop (no more `forwardRef`), the `use()` hook for reading promises and context, form Actions with `useActionState` and `useFormStatus`, `useOptimistic`. If they are on 19, the acknowledge flow in the front-end whiteboard could use `useOptimistic`. Ask which version they run.
- **Server components** exist and are Next.js territory. Say you know the distinction and that a Lambda + React SPA setup likely does not use them.

---

## Express (you just built one)

- Middleware chain, `next()`, and the four-argument error handler `(err, req, res, next)` registered last.
- Validate the body at the boundary (Zod), return 400 with a consistent error shape.
- Async route handlers need their rejections caught (Express 5 does it; Express 4 needs a wrapper), or a thrown error hangs the request.
- Your contacts API is a ready example: strict TS, prepared statements, a written decision on why no ORM for one table.

---

## Big-O in one breath

Array lookup by value O(n); `Map`/`Set`/object key lookup O(1); sort O(n log n); nested loop over two lists O(n·m), fixed by building a `Map` of one first. Say the complexity unprompted after any code you write. It costs five seconds and reads as senior.

---

## Quick self-check

1. Flex or grid for a dashboard of cards? For a toolbar? Why?
2. Why is a modal rendering behind the header, and what do you check first?
3. CSRF in one sentence, and why bearer tokens in a header are not vulnerable to it.
4. `httpOnly` cookie vs in-memory token: name the tradeoff.
5. Why query by role in RTL instead of by class name?
6. How would you unit test the Snippet B handler?
7. Derive a union type from a `const` array.
8. What does `useTransition` buy you? What replaced `forwardRef` in React 19?
