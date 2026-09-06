# React + TypeScript Review

The role is front-end-first. This is your most-weighted technical area. Goal: be able to speak each of these in under 60 seconds with a concrete example.

---

## Rendering model

**What triggers a re-render?**
- Local state change (`setState`)
- New props from parent
- Parent re-renders (children re-render by default, memoized or not — unless wrapped in `React.memo`)
- Context value change (every consumer re-renders)

**The reference-identity trap.** React compares with `Object.is`. A new object/array/function *identity* counts as a change even when contents are equal. This is the source of most accidental re-render churn and stale-effect bugs.

```tsx
// New array identity every render → effect fires every render
useEffect(() => { ... }, [{ id }]);        // ❌
useEffect(() => { ... }, [id]);            // ✅ primitive
```

**Bailout on same reference.** If you call `setState` with the *same* reference you already hold, React bails and skips the render. This is exactly the Snippet A bug (`setAlerts(alerts)`). Always produce a new reference for changed state.

```tsx
setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a)); // ✅
```

---

## useEffect: the round they'll probe

**Dependency array + stale closures.** An effect captures the values from the render it ran in. Omit a dependency and the closure keeps stale values forever. The lint rule (`react-hooks/exhaustive-deps`) exists because this bug is silent.

**Cleanup + race conditions.** Two rapid prop changes → two fetches → they can resolve out of order → you render the wrong data. Cleanup cancels in-flight work.

```tsx
useEffect(() => {
  const ctrl = new AbortController();
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/alerts`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancelled) setAlerts(data.alerts);
    } catch (err) {
      if (!cancelled && (err as Error).name !== 'AbortError') setError(err as Error);
    }
  })();
  return () => { cancelled = true; ctrl.abort(); };
}, [customerId]);  // ← the dependency that Snippet A is missing
```

**Strict Mode double-invoke.** In dev, React 18 mounts → unmounts → remounts every component once, so effects run twice. This surfaces missing cleanup. It's dev-only; it doesn't happen in production. Know this — it's a common "why does my fetch fire twice" gotcha.

**Effects vs a query library.** Rolling your own fetch means hand-writing caching, dedupe, retries, and race handling. React Query / SWR exist because everyone writes those bugs once. Fine to say "I'd reach for React Query rather than a raw effect for server state."

---

## Hooks reference

- **`useState`** — local state; setter is stable across renders (safe to omit from deps). Functional updater `setX(prev => ...)` avoids stale-closure reads.
- **`useEffect`** — side effects after paint. Cleanup runs before the next effect and on unmount.
- **`useLayoutEffect`** — runs synchronously before paint; use only for DOM measurement to avoid flicker.
- **`useMemo`** — cache an expensive computation; also to stabilize an object/array identity that feeds a dependency array.
- **`useCallback`** — `useMemo` for functions; only useful when the function is a dependency or passed to a memoized child.
- **`useRef`** — mutable value that persists across renders without triggering one; also DOM node access.
- **`useContext`** — read a context; re-renders on value change.
- **`useReducer`** — state with complex transitions; preferred over multiple related `useState` calls.

**Rules of hooks:** call at the top level, same order every render, only from components/custom hooks. The order is how React associates state with each hook call.

**When memoization actually helps:** the child is genuinely expensive, *or* the value feeds a dependency array. `useMemo` on a cheap computation adds cost and noise. Measure first. Have this opinion ready — over-memoizing reads as cargo-culting.

---

## Keys

Keys tell React which element is which across renders. Index keys corrupt component state (and inputs) when the list **reorders, filters, or inserts** — not when it only appends. Use a stable domain id (`alert.id`). This is a favorite interview trap because index keys "work" until they don't.

---

## Forms

- **Controlled** — value lives in React state (`value` + `onChange`). Predictable, needed for validation-on-type.
- **Uncontrolled** — DOM holds the value, read via ref. Less code for simple cases.
- Know where validation lives and how **server-side errors** map back onto fields. Mantine's `useForm` (see `tooling-review.md`) handles this; be able to describe the shape.

---

## Accessibility (they say "accessible" twice in the JD)

- Interactive elements must be real interactives: `<button>`, not `<div onClick>`. Divs aren't keyboard-reachable, have no role, and aren't announced.
- Label every input (`<label htmlFor>` or `aria-label`).
- Visible focus states; logical tab order.
- Don't render server strings as HTML (`dangerouslySetInnerHTML`) — that's the Snippet A stored-XSS finding.
- Color contrast; don't encode meaning in color alone (relevant to a severity/status UI).

Accessibility is explicitly in "What You'll Do." Raising it unprompted in code review or whiteboarding is high-signal here.

---

## Performance toolkit

- `React.memo` — skip re-render when props are shallow-equal.
- `useMemo` / `useCallback` — stabilize expensive values / identities.
- List virtualization (`react-window`) — render only visible rows for large lists (a per-location compliance table could be thousands of rows).
- Code splitting — `React.lazy` + `Suspense` to defer route bundles.
- Move state down / lift only as far as needed — narrow the re-render blast radius.

---

## TypeScript in React

**`unknown` vs `any`.** `unknown` forces a narrowing check before use; `any` disables checking and propagates silently. Untrusted server data should land as `unknown` (or be validated with Zod) at the boundary, never `any`. Typing state `useState<any>([])` — Snippet A's mistake — defeats TS at the exact point it matters most.

**Discriminated unions + exhaustiveness.** The highest-signal TS answer. A literal discriminant field lets the compiler narrow, and a `never` check turns "added a variant, forgot a case" into a compile error.

```ts
type Alert =
  | { kind: 'minWage';   state: string; rate: number }
  | { kind: 'paidLeave'; state: string; days: number }
  | { kind: 'posting';   jurisdiction: string };

function summarize(a: Alert): string {
  switch (a.kind) {
    case 'minWage':   return `Min wage ${a.rate} in ${a.state}`;
    case 'paidLeave': return `${a.days} days leave in ${a.state}`;
    case 'posting':   return `Posting for ${a.jurisdiction}`;
    default:
      const _exhaustive: never = a;   // compile error if a case is missing
      return _exhaustive;
  }
}
```

**`as` is a smell.** It asserts rather than proves — if the shape is wrong the error surfaces later and further away. Prefer type guards (`if ('rate' in a)`) or validation.

**Utility types worth naming:** `Partial<T>`, `Pick<T,K>`, `Omit<T,K>`, `Record<K,V>`, `ReturnType<T>`, `Awaited<T>`. Useful for a repository/DTO layer.

**Generics in practice.** Don't define them abstractly — describe a real one you wrote: a typed API client (`get<T>(url): Promise<T>`) or a repository wrapper. Concrete beats theoretical.

**`interface` vs `type`.** Interfaces merge and are conventional for object contracts; type aliases handle unions/intersections/mapped types. Mostly stylistic — answer in one sentence, don't over-invest.

---

## Component-props typing patterns

```tsx
// Prefer explicit prop types; discriminate variants
type ButtonProps = {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

// Extend native element props when wrapping DOM elements
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };
```

---

## Quick self-check questions

1. Why does `setAlerts(alerts)` fail to re-render after mutating an item? (reference bailout)
2. Why does an effect with `[]` deps show stale data when a prop changes? (missing dep / stale closure)
3. When is an index key actually a bug? (reorder/filter/insert, not append)
4. `unknown` vs `any` — which for an API response and why?
5. Show a discriminated union with an exhaustiveness check.
6. When does `useMemo` help, and when is it just noise?
7. Why is `<div onClick>` an accessibility bug and what replaces it?
