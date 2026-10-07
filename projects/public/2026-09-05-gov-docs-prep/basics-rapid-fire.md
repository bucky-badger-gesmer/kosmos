# Basics Rapid-Fire — Git, React, TypeScript, Debugging, Front-End Performance

Last year the tech questions were *basics* of Git, TypeScript, and React. The other files skew senior. This one is the plain answers, one to three lines each, for the questions a screener asks in the first ten minutes. Say the short answer first, then add the "why" only if they lean in.

---

## Git

**The model in one breath.** Working tree (your files) → index / staging area (`git add`) → commit (a snapshot with a parent pointer) → branch (a movable pointer to a commit) → `HEAD` (the branch you have checked out).

- **`fetch` vs `pull`.** `fetch` downloads remote refs and objects, touches nothing you have checked out. `pull` is `fetch` plus a `merge` (or a `rebase` with `--rebase`). Say you `fetch` and look before you `pull`.
- **Undo the last commit.** `git reset --soft HEAD~1` keeps the changes staged. `--mixed` (the default) keeps them in the working tree, unstaged. `--hard` throws them away. Only on commits you have not pushed.
- **Undo a pushed commit.** `git revert <sha>` makes a new commit that inverts it. History is shared, so you add, you do not rewrite.
- **Fix the last commit message or add a forgotten file.** `git commit --amend`. It rewrites the commit's SHA, so unpushed only.
- **Committed to the wrong branch.** `git switch -c feature` creates a branch at the commit, then `git switch main && git reset --hard origin/main` puts `main` back. Or `git cherry-pick <sha>` onto the right branch and reset the wrong one.
- **`stash`.** Shelves uncommitted work: `git stash`, `git stash pop`, `git stash list`. `-u` includes untracked files. Use it to switch branches mid-change.
- **Merge vs rebase.** Merge keeps history as it happened and adds a merge commit. Rebase replays your commits on a new base for a linear history and rewrites SHAs. Rule: rebase your own unpushed branch, never a shared one. Squash-merge PRs for a clean `main`.
- **Resolving a conflict, step by step.** `git status` lists the files. Open each, resolve the `<<<<<<<` / `=======` / `>>>>>>>` blocks, keep what is right, delete the markers. `git add` the file. `git commit` for a merge, `git rebase --continue` for a rebase. `git merge --abort` or `git rebase --abort` to back out.
- **`cherry-pick`.** Copy one commit onto the current branch. Hotfix to a release branch.
- **`reflog`.** A log of where `HEAD` has been. The way back from a bad `reset --hard`: find the SHA in `git reflog`, `git reset --hard <sha>`.
- **Detached HEAD.** You checked out a commit, not a branch. Commits made there are orphaned when you leave. `git switch -c name` to keep them.
- **`bisect`.** Binary search over commits to find the one that introduced a bug. `git bisect start`, `bad`, `good`, test, repeat.
- **Stop tracking a file that is already committed.** Add it to `.gitignore`, then `git rm --cached <file>`. `.gitignore` alone does nothing for tracked files.
- **Force push.** `--force-with-lease` refuses if someone else pushed since you fetched. Plain `--force` overwrites their work.
- **Daily commands worth having fluent.** `git log --oneline --graph`, `git diff --staged`, `git blame`, `git switch -c`, `git push -u origin branch`.
- **Commit messages.** Imperative subject under 50 characters, body explains why. Your repos use conventional commits (`feat:`, `fix:`, `chore:`), so say that.
- **PR workflow.** Branch off `main`, small focused commits, open a PR, CI runs, review, squash-merge. Never commit straight to `main`.

---

## React

- **What React is.** A library for building UIs from components. You describe what the UI should look like for a given state, and React updates the DOM to match.
- **JSX.** Syntax sugar for `React.createElement` calls. It compiles to plain JavaScript, which is why `className` and `htmlFor` exist and why you can put expressions in braces.
- **Virtual DOM and reconciliation.** Rendering produces a tree of plain element objects. React diffs the new tree against the previous one and commits only the changed DOM nodes. Keys tell the diff which list items are the same across renders.
- **Props vs state.** Props come from the parent and are read-only. State is owned by the component and changed through its setter. A change to either triggers a re-render.
- **Never mutate state.** React compares by reference. Mutating an object in place and setting it back looks unchanged, so nothing re-renders. Make a new object or array.
- **Hooks.** Functions that let function components hold state and side effects. Two rules: call them at the top level, and only from components or other hooks. The call order is how React maps state to each hook.
- **Lifecycle mapping, if they ask in class terms.** `componentDidMount` → `useEffect` with `[]`. `componentDidUpdate` → `useEffect` with deps. `componentWillUnmount` → the effect's cleanup function.
- **Side effects: handler or effect?** If a user action causes it, put it in the event handler. Effects are for syncing with something outside React: a subscription, a fetch that must run because the component is showing.
- **Lifting state up.** When two siblings need the same state, move it to their closest common parent and pass it down.
- **Prop drilling and composition.** Passing props through layers that do not use them. First fix is composition: pass the child element as `children` so the middle layers do not know about it. Second fix is Context.
- **Context.** Read-everywhere, changes-rarely data: current user, theme, tenant. Every consumer re-renders when the value changes, so keep contexts small and split them, and memoize the value object.
- **Global state, the honest answer.** Most "global state" is server data. That goes in React Query or SWR, which cache it. What is left is small client UI state: Context if it changes rarely, Zustand if it changes often or many components write to it. Redux Toolkit when you want a single store with middleware and devtools across a large app. Say you would start with React Query plus Context and add a store only when it hurts.
- **Custom hooks.** Extract stateful logic that two components share into a `useSomething` function. It is just a function that calls hooks. `useDebouncedValue` and `useFetch` in `coding-warmups.md` are examples.
- **Error boundaries.** A component that catches render errors in its subtree and shows a fallback instead of unmounting the whole app. Only class components can define one (`getDerivedStateFromError`, `componentDidCatch`), so most teams use the `react-error-boundary` package. They do not catch errors in event handlers or async code. Put one around each route and around risky widgets so one broken panel does not blank the page.
- **Portals.** Render children into a DOM node outside the parent, keeping React context and events. Modals, tooltips, drawers. Mantine's `Modal` and `Drawer` use one.
- **Controlled vs uncontrolled inputs.** Controlled: `value` plus `onChange`, React owns the value. Uncontrolled: the DOM owns it, you read it with a ref. Controlled for validation as you type.
- **Fragments.** `<>...</>` returns several siblings without a wrapper `div`.
- **Refs.** `useRef` holds a mutable value across renders without causing one. DOM access, timers, previous values.
- **Code splitting.** `React.lazy` plus `Suspense` loads a component's bundle on first render. Routes and heavy modals.
- **React Router.** `useParams` for path params, `useSearchParams` for query params (this is how "filters live in the URL" works in the front-end whiteboard), `useNavigate` to move programmatically, `<Outlet>` for nested layouts.
- **Strict Mode.** Dev-only. Double-invokes renders and effects to surface missing cleanup. Not a bug.
- **Why did my component render twice / my fetch fire twice?** Strict Mode in dev, or a parent re-rendering. Check with the React DevTools Profiler before reaching for `memo`.

---

## TypeScript

- **What it is.** A static type layer over JavaScript. The compiler checks types and then erases them. At runtime there are no types, which is why data from an API still needs runtime validation (Zod) at the boundary.
- **Annotate boundaries, infer locals.** Function parameters, return types on exported functions, and API shapes get explicit types. `const x = 5` does not need one.
- **`?` and `!`.** `name?: string` makes a property optional, its type becomes `string | undefined`. `value!` is the non-null assertion: you are telling the compiler it is not null. It does nothing at runtime. `process.env.MONGO_URI!` in the Lambda snippets is this. Prefer a startup check that throws a clear error.
- **`readonly`.** Prevents reassignment of a property or array element at compile time. `as const` makes a literal deeply readonly and keeps literal types.
- **Arrays, tuples, records.** `string[]`, `[string, number]` for a fixed-shape pair, `Record<string, Alert>` for a dictionary.
- **Union and intersection.** `A | B` is one or the other. `A & B` is both. Unions narrow with `typeof`, `in`, `instanceof`, or a discriminant field.
- **`keyof`, `typeof`, indexed access.** `keyof Alert` is the union of its property names. `typeof STATUSES[number]` derives a union from a const array. `Alert['severity']` reads one property's type.
- **`null`, `undefined`, `void`, `never`.** `null` and `undefined` are values. `void` is "returns nothing." `never` is "cannot happen," used for exhaustiveness checks and functions that always throw.
- **Type guards.** `function isAlert(x: unknown): x is Alert`. A function whose return type narrows the argument. Preferred over `as`.
- **Structural typing.** Two types are compatible if their shapes match, names do not matter. Object literals get excess-property checks, which is why an extra key in a literal errors but the same object through a variable does not.
- **Generics.** A type parameter so one function or type works for many shapes: `function first<T>(xs: T[]): T | undefined`. Constrain with `extends`. Have your real example ready, a typed `get<T>(url)` or `useFetch<T>`.
- **Utility types.** `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited`. Name two and what you used them for.
- **`interface` vs `type`.** One sentence: interfaces merge and suit object contracts, type aliases do unions and mapped types. Otherwise interchangeable.
- **`enum` vs union.** Prefer string literal unions. Enums emit runtime code and do not round-trip through JSON cleanly.
- **Declaration files.** `.d.ts` files describe types for JS. `@types/*` packages are community declarations, for example `@types/aws-lambda`.
- **`tsconfig` you should be able to name.** `strict: true` (turns on `strictNullChecks` and friends), `target`, `module`, `noUncheckedIndexedAccess` if you want to sound careful about array indexing.
- **Typing React props.** A `type Props = {...}` and `function Button({ variant }: Props)`. `React.FC` is fine but not required. `React.ReactNode` for children. Event types: `React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`.
- **Common errors and what they mean.** "Object is possibly undefined" means a missing null check. "Type X is not assignable to type Y" means read both types, the fix is usually at the wider one. "Property does not exist on type never" means you narrowed everything away.

---

## "How do you debug a bug across the stack?"

The JD lists this as a duty. Have the method, then a real story.

1. **Reproduce it.** Exact steps, which user, which tenant, which environment. If you cannot reproduce it, get the request id or timestamp from the report.
2. **Find the layer.** Network tab: did the request go out, what came back, what status. If the response is wrong, the bug is on the server. If the response is right, it is in the client.
3. **Follow the correlation id.** The `awsRequestId` or trace id ties the browser request to the Lambda log lines and the Datadog trace. Read the log for that one request, not the whole stream.
4. **Narrow inside the layer.** Server: reproduce the query in a shell, `explain` it, check the data. Client: React DevTools for the state, a breakpoint in the handler.
5. **Fix the cause, not the symptom.** Then write the regression test at the lowest layer that catches it.
6. **Prevent the class.** A type, a validation, a lint rule, an alert.

Say the method in 30 seconds, then tell the story from your worksheet, front-end symptom with a backend cause.

---

## Front-end performance vocabulary

One paragraph so "how do you make it fast" has an answer beyond `useMemo`.

- **Core Web Vitals.** LCP (largest content painted, target under 2.5 s), INP (interaction to next paint, under 200 ms), CLS (layout shift, under 0.1). These are what Datadog RUM and Lighthouse report.
- **Levers, biggest first.** Ship less JavaScript (code split by route, tree-shake, check the bundle with an analyzer). Load images lazily with `loading="lazy"` and give them width and height so they do not shift layout. Cache API responses (React Query) and static assets (CDN, long `Cache-Control`). Paginate or virtualize long lists. Only then memoize, and only after the Profiler shows a hot component.
- **Measuring.** Lighthouse for a lab number, RUM for what real users see, the React Profiler for which component is slow. Say "measure first" every time.

---

## Quick self-check

1. `fetch` vs `pull` in one sentence. Three flavors of `reset`.
2. Walk through resolving a merge conflict from `git status` to the commit.
3. What is an error boundary, what does it not catch, and where do you put them?
4. Where does global state live in a React app you would build today?
5. What does the `!` after `process.env.MONGO_URI` do at runtime?
6. Derive a union type from a const array.
7. Give the six-step debugging method in 30 seconds.
8. Name the three Core Web Vitals and the first lever you would pull.
