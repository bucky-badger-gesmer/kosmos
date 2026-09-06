# Coding Warm-ups — In Case "Whiteboarding" Means Writing Code

At a small engineering shop, "whiteboarding" often means a marker and a 15-minute function, not a system diagram. None of the other files cover that. These are the shapes that show up most for a React/TypeScript/Node role. Work each one cold on paper, then compare. Say your plan out loud before writing a line, and name the complexity when you finish.

**The rhythm to run every time:** restate the problem → one example input and output → edge cases (empty, one item, duplicates, nulls) → write it → walk one example through by hand → name Big-O.

---

## 1. `debounce`

Classic. Also explains the search box in every whiteboard.

```ts
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

Say: debounce waits for quiet, throttle guarantees at most one call per interval. Search input is debounce; scroll handler is throttle. `ReturnType<typeof setTimeout>` avoids the Node-vs-browser timer type mismatch.

---

## 2. `useDebouncedValue` hook

Same idea as a React hook. Shows you know effect cleanup.

```ts
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
```

Say: the cleanup cancels the pending timer when `value` changes, so only the last value in a burst lands. Mantine ships this as `useDebouncedValue`.

---

## 3. `groupBy`

Comes up as "count alerts per jurisdiction" or "group locations by state."

```ts
function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
// groupBy(alerts, a => a.jurisdiction)
```

Say: O(n) time, single pass. `??=` assigns only if nullish. Mention `Object.groupBy` exists in newer runtimes but you would not rely on it without checking targets.

---

## 4. `useFetch` with abort and race protection

The hook version of the Snippet A fixes. If they ask you to "fix" a fetching component live, this is the target.

```ts
type State<T> = { status: 'idle' | 'loading' | 'success' | 'error'; data?: T; error?: Error };

function useFetch<T>(url: string): State<T> {
  const [state, setState] = useState<State<T>>({ status: 'idle' });
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetch(url, { signal: ctrl.signal })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<T>; })
      .then(data => setState({ status: 'success', data }))
      .catch(err => { if (err.name !== 'AbortError') setState({ status: 'error', error: err }); });
    return () => ctrl.abort();
  }, [url]);
  return state;
}
```

Say: the discriminated `status` field means the component can never be "loading with data and an error" at once. Abort on cleanup kills the stale-response race. In production you would use React Query instead of writing this.

---

## 5. Affected locations by jurisdiction prefix

Domain-flavored. Ties straight to the notification-system whiteboard.

```ts
type Location = { id: string; tenantId: string; jurisdictionPath: string }; // 'US/MN/Hennepin/Minneapolis'

function affectedTenants(locations: Location[], changedPath: string): Set<string> {
  const prefix = changedPath.endsWith('/') ? changedPath : changedPath + '/';
  const out = new Set<string>();
  for (const loc of locations) {
    if (loc.jurisdictionPath === changedPath || loc.jurisdictionPath.startsWith(prefix)) out.add(loc.tenantId);
  }
  return out;
}
```

Say: the trailing slash matters, otherwise `US/MN` matches `US/MNX`. O(n) over locations in memory; in Mongo the same idea is an anchored regex `^US/MN(/|$)` on an indexed field. A `Set` dedupes tenants for free.

---

## 6. Dedupe by key, keeping the last occurrence

"Import rows may repeat; keep the newest."

```ts
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(key(item), item);   // later wins
  return [...map.values()];
}
```

Say: `Map` preserves insertion order of first insert, so output order follows first appearance while the value is the last seen. O(n).

---

## 7. Flatten a jurisdiction tree

Recursion check. Also a natural "render a nested menu" question.

```ts
type Node = { name: string; children?: Node[] };

function flatten(node: Node, path: string[] = []): string[] {
  const here = [...path, node.name];
  const self = here.join('/');
  return [self, ...(node.children ?? []).flatMap(c => flatten(c, here))];
}
// flatten({ name: 'US', children: [{ name: 'MN', children: [{ name: 'Hennepin' }] }] })
// → ['US', 'US/MN', 'US/MN/Hennepin']
```

Say: O(n) nodes. Mention an explicit stack if depth could blow the call stack, then say for a jurisdiction tree it never will.

---

## 8. Event-loop output prediction

They may just write this on the board and ask "what prints?"

```js
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => console.log(3)).then(() => console.log(4));
queueMicrotask(() => console.log(5));
(async () => { console.log(6); await null; console.log(7); })();
console.log(8);
```

Answer: `1 6 8 3 5 7 4 2`. Sync first (1, 6, 8). Then microtasks in the order they were queued: 3, 5, 7; the `.then(4)` was queued when 3 ran, so it comes after 7. Then the macrotask, 2.

If you can narrate that cleanly, you have shown you understand the event loop better than most.

---

## 9. Paginate an array (for the Load More bug)

```ts
function page<T>(items: T[], pageNumber: number, pageSize: number): { items: T[]; total: number; hasMore: boolean } {
  const start = (pageNumber - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { items: slice, total: items.length, hasMore: start + pageSize < items.length };
}
```

Say: one-indexed pages, `hasMore` so the UI can disable Load More. Confirm indexing convention with the API before writing the client.

---

## If you freeze

Say what you are stuck on. "I know I want a map from key to items, I'm deciding between `reduce` and a `for` loop." Interviewers unstick candidates who narrate and abandon candidates who go silent. A `for` loop you finish beats a `reduce` you don't.
