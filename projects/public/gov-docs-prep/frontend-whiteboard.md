# Front-End Whiteboard — Design a React App

Last year the whiteboard round was **"whiteboard a React app."** The JD is front-end first. The other three whiteboard scenarios in `govdocs-tech-panel-prep.md` are all backend, so this file fills the most likely gap. Work it the same way as `whiteboard-walkthrough.md`: cover the file, set 15 minutes, do it twice.

---

## The prompt

> *"Design the customer-facing Locations dashboard. A customer with anywhere from 5 to 5,000 worksite locations needs to see each location's posting compliance status, search and filter, drill into a location to see its alerts, and acknowledge an alert."*

If they hand you a different feature, the spine below still applies.

---

## The front-end spine (run this every time)

**Clarify → Screens and flows → Component tree → State (where each piece lives) → Data contract → Loading, empty, error → Performance → Accessibility and responsive → Testing → Tradeoffs**

Say the spine out loud at the start, same as the backend one. It shows you have a plan.

---

## Step 1 — Clarify (2 min)

- Who is the user? Compliance admin at the customer. A few users per customer, not thousands.
- Scale: up to 5,000 locations, so **server-side pagination and filtering**, not a client-side array.
- What is "compliance status"? Assume a small enum: `compliant | action_required | pending_verification`.
- Does acknowledging need a note or a reason? Assume yes, it is an audit record.
- Existing design system? Assume Mantine, per the JD.
- Auth is handled by an existing app shell. Out of scope.

**[SAY]** *"I'll assume up to five thousand locations, so I'm going to page and filter on the server, a small status enum, Mantine as the component library, and that acknowledging writes an audit record with a note. Correct me if any of that is off."*

---

## Step 2 — Screens and flows (1 min)

One page, one drawer, one modal:

1. **Locations page**: filter bar on top, table below, pagination at the bottom.
2. **Location detail drawer**: slides in from the right when a row is clicked. Shows the location's alerts.
3. **Acknowledge modal**: opened from an alert. Note field, confirm button.

Flow to trace later: filter to "action required" → open a location → acknowledge one alert → row status updates.

---

## Step 3 — Component tree (3 min)

Draw it as a tree:

```
<LocationsPage>
  <FiltersBar>            search input, status select, jurisdiction select, clear button
  <LocationsTable>        thead + rows; each row is <LocationRow>
    <StatusBadge>         icon + text, never color alone
  <Pagination>
  <LocationDrawer>        opened by selectedLocationId in the URL
    <AlertsList>
      <AlertRow>          <Button>Acknowledge</Button>
    <AcknowledgeModal>    Mantine useForm: note (required)
```

**[SAY]** *"I split by responsibility: the page owns coordination, the filter bar and table are presentational and take props, and the drawer is its own data boundary because it fetches alerts for one location."*

---

## Step 4 — State: where each piece lives (4 min, spend the most time here)

This is the highest-signal part. Interviewers want to hear that not all state is the same.

| State | Where it lives | Why |
|---|---|---|
| Locations list, alerts | **Server state** via React Query (or SWR) | Caching, dedupe, refetch, retries, and race handling for free. Hand-rolled `useEffect` fetching is where the Snippet A bugs come from. |
| Search text, status filter, page, selected location id | **URL search params** | Shareable, survives refresh, back button works, deep-linkable from an email alert. |
| Drawer open, modal open, hover, form values | **Local component state** | Ephemeral UI state nobody else needs. |
| Current user, tenant, theme | **Context** | Read everywhere, changes rarely. |

**[SAY]** *"Filters go in the URL, not in `useState`. A compliance admin will paste a link to a coworker saying 'look at these action-required locations in Minnesota', and that only works if the filter is in the URL. It also makes the back button behave."*

**Search input**: debounce the URL update by about 300 ms (`useDebouncedValue` from Mantine hooks). Otherwise every keystroke is a request.

**Types**: a discriminated union for status, and validate the API response at the boundary with Zod rather than casting with `as`.

```ts
type ComplianceStatus = 'compliant' | 'action_required' | 'pending_verification';
type Location = { id: string; name: string; jurisdictionPath: string; status: ComplianceStatus; openAlerts: number };
```

---

## Step 5 — Data contract (2 min)

```
GET  /api/locations?search=&status=&jurisdiction=&page=1&pageSize=50
     → { items: Location[], total: number }

GET  /api/locations/:id/alerts
     → { items: Alert[] }

POST /api/alerts/:id/ack   { note: string }
     → 200 { alert: Alert }   (server sets acknowledgedBy from auth, never from the body)
```

**[SAY]** *"The server does the filtering and paging. The response includes `total` so the pagination control knows how many pages exist. Who acknowledged comes from the auth context on the server, not from the request body, because this is an audit record."*

Optional: cursor pagination instead of page numbers if the list is sorted by something that changes. Say you'd start with page numbers because the UI needs "page 3 of 40."

---

## Step 6 — Loading, empty, error (2 min)

Name all three for the table and for the drawer. Most candidates only handle the happy path.

- **Loading**: skeleton rows, same height as real rows, so the layout does not jump. Keep the filter bar interactive.
- **Empty**: two different messages. "You have no locations yet" versus "No locations match these filters" with a clear-filters button. Conflating them is a real UX bug.
- **Error**: inline message with a retry button. Do not blank the whole page because one request failed.
- **Acknowledge**: optimistic update with rollback. Mark the alert acknowledged immediately, send the request, revert and show an error notification if it fails. React Query's `onMutate` / `onError` / `onSettled` is the shape. After success, invalidate the locations query so the row's open-alert count updates.

**[SAY]** *"Optimistic is fine here because the server remains the source of truth and the rollback is visible. If this were a payment I'd be pessimistic."*

---

## Step 7 — Performance (1 min)

- Server pagination is the main answer. Fifty rows a page renders instantly.
- If product later wants an infinite list, virtualize with `@tanstack/react-virtual` or `react-window`. Mantine core does not ship a virtualized table; do not claim it does.
- Wrap `LocationRow` in `React.memo` only if profiling shows the table re-rendering on drawer state changes. Say "measure first."
- Code-split the drawer and modal with `React.lazy`. They are not needed on first paint.

---

## Step 8 — Accessibility and responsive (2 min)

The JD says "accessible" twice. Raise this unprompted.

- Real `<table>` with `<thead>`, `<th scope="col">`, and a caption or `aria-label`.
- Status shown as **icon plus text**, not color alone.
- Rows are not clickable divs. The location name is a `<button>` or link that opens the drawer, so it is keyboard reachable and announced.
- Drawer and modal trap focus and return it on close. Mantine does this for you. Say that you know it does.
- Acknowledge success announced through an `aria-live` region or Mantine notification.
- Responsive: below the `sm` breakpoint, render the table as a stacked card list. Mantine's `hiddenFrom` / `visibleFrom` props or `useMediaQuery`.

---

## Step 9 — Testing (2 min)

Three layers. Say where each bug from the day would be caught.

- **Unit** (Vitest): pure helpers such as building the query string from filters, and the status-to-label mapping.
- **Component** (React Testing Library + MSW to mock the API): renders skeleton, then rows; empty state text differs by filter; acknowledge rolls back on a 500.
- **End to end** (Playwright): the one critical journey. Filter to action required, open a location, acknowledge, assert the badge changes. Use `getByRole` locators and `page.route` to stub the API so the test is deterministic.

```ts
test('acknowledges an alert from the locations dashboard', async ({ page }) => {
  await page.goto('/locations?status=action_required');
  await page.getByRole('button', { name: /minneapolis warehouse/i }).click();
  await page.getByRole('button', { name: /acknowledge/i }).first().click();
  await page.getByLabel(/note/i).fill('Poster replaced 9/9');
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByText(/acknowledged/i)).toBeVisible();
});
```

---

## Step 10 — Tradeoffs you rejected (1 min)

- **Client-side filtering of the full list**: simpler, but 5,000 rows times future growth means a large first payload and a slow filter. Rejected.
- **Filters in `useState`**: less plumbing, but loses deep links and back-button behavior. Rejected.
- **Hand-rolled `useEffect` fetching**: fewer dependencies, but you end up rewriting caching, dedupe, and race handling. Rejected.
- **Pessimistic acknowledge**: safer, but slower feel for a low-risk action with a visible rollback. Rejected for this case.

---

## If we had more time

Bulk acknowledge with a selection column, saved filter views, export to CSV via a server-generated file, and a Datadog RUM dashboard on time-to-first-row and error rate for the acknowledge call.

---

## The rubric

- Did you separate server state, URL state, and local state, and say why?
- Did you name loading, empty, and error states without being asked?
- Did you raise accessibility unprompted?
- Did you describe how you would test it, at three layers?
- Did you state assumptions and keep moving?

Now cover this file and do it on paper. Twice.
