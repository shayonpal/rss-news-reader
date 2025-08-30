# Claude's Message (Aug 27, 5:41am)

## Feature Overview

The auto-parse content hook (`useAutoParseContent`) automatically fetches full article content when RSS feeds provide only partial content or truncated summaries. It detects when articles need parsing based on content length, feed configuration, or truncation indicators.

## Goal

Fix failing tests that are causing memory exhaustion and infinite re-renders. All 11 tests in the auto-parse logic test suite should pass without memory issues.

## Challenges Faced

1. **Memory Exhaustion**: Tests timeout with "JS heap out of memory" errors
2. **Dependency Cycle**: The `triggerParse` callback depends on `isParsing` state, creating circular dependencies
3. **Infinite Re-renders**: React effects re-trigger continuously, exhausting memory
4. **Test Infrastructure Issues**: Interaction between fake timers, React Testing Library, and async operations

## Attempted Solutions

### Production Code Fixes

1. **Added `isParsingRef`**: Created ref to track parsing state without causing dependencies
   - Syncs with state via effect: `useEffect(() => { isParsingRef.current = isParsing; }, [isParsing])`
   - `triggerParse` checks ref instead of state: `if (!isManual && isParsingRef.current) return;`
   - Removed `isParsing` from `triggerParse` dependencies

2. **Fixed `processedArticlesRef` Logic**:
   - Clear ref when article changes to allow re-triggering
   - Only add to processed set if not already parsing to prevent race conditions

### Test Infrastructure Fixes

1. **Timer Management**:
   - Tried fake timers with `vi.useFakeTimers()`
   - Switched to async timer APIs (`vi.advanceTimersByTimeAsync`)
   - Added microtask flushing with `await Promise.resolve()`
   - Removed `setTimeout` from all fetch mocks
   - Eventually removed fake timers entirely

2. **Cleanup Patterns**:
   - Added `cleanup()` before timer operations in `afterEach`
   - Implemented bounded timer drain to detect infinite loops
   - Clear all timers and mocks between tests

## Files to Review

### Production Code

- `src/hooks/use-auto-parse-content.ts` - The hook with the dependency cycle issue
  - Lines 49-55: `isParsingRef` implementation
  - Lines 57-143: `triggerParse` callback
  - Lines 162-203: Auto-parse effect with dependencies

### Test Files

- `src/__tests__/unit/rr-176-auto-parse-logic.test.ts` - Failing test suite
  - Test "should trigger for ANY feed when content < 500 chars" hangs indefinitely
  - Uses `renderHook`, `waitFor`, and `act` from React Testing Library

### Related Files

- `src/types/index.ts` - Article and Feed type definitions
- `src/app/api/articles/[id]/fetch-content/route.ts` - API endpoint being called

## Key Questions

1. **Dependency Management**: Is there a better pattern to handle the `isParsing` state without refs? Should `triggerParse` be stable using `useCallback` with empty dependencies and accessing state via refs?

2. **Effect Design**: Should the auto-parse logic be in a single consolidated effect rather than having `triggerParse` as a dependency? Would a state machine pattern be more appropriate?

3. **Test Isolation**: Why does the third test specifically hang while the first two pass? Is there shared state between tests despite cleanup?

4. **Memory Leak Source**: Even with the dependency cycle supposedly fixed, memory exhaustion persists. Are there multiple render loops happening due to StrictMode or other React 18 behaviors?

5. **React Testing Library**: Is `waitFor` incompatible with certain timer configurations? Should tests use a different approach for waiting on async state updates?

6. **Ref Patterns**: The current solution uses both `isParsingRef` and `processedArticlesRef`. Is this dual-ref approach causing unexpected behavior when combined with React's concurrent features?

Claude

---

# Siri's Message (Aug 27, 5.49p)

Summary

- Root cause: tight effect/closure coupling lets the auto-parse effect and `triggerParse` interact in ways that can retrigger state updates under certain timing (especially with concurrent React behaviors and test timing), causing runaway renders and heap growth.
- Symptoms are amplified by tests mixing immediate assertions with async effects and occasionally delayed fetch mocks.

Proposed fix (production code)

- Make `triggerParse` identity truly stable and state-free:
  - Define `triggerParse` with `useCallback([])` and read all mutable values via refs: `articleRef`, `isParsingRef`, `mountedRef`, and a new `jobsRef`.
  - Keep refs in sync via tiny effects: `useEffect(() => { articleRef.current = article; }, [article])`.
- Replace boolean/set guards with a tiny per-article state machine:
  - `jobsRef: Map<string, 'idle' | 'scheduled' | 'running' | 'done' | 'failed'>`.
  - Auto-parse effect: if `needsParsing && job in {'idle', undefined}` then set state to `scheduled` and `queueMicrotask(() => triggerParse(false))`.
  - Inside `triggerParse`: if job is `running` or `scheduled` and not manual, return early; otherwise flip to `running`, then to `done`/`failed` on completion.
- Remove `triggerParse` from the auto-parse effect deps:
  - The effect already depends on article/feed fields that define `needsParsing`; it will rerun on meaningful changes without chasing a changing callback identity.
- Keep aborts and mount checks exact:
  - Abort any prior request before starting a new one.
  - Before any `setState`, confirm `mountedRef.current` and the `articleRef.current.id` match the request’s `currentArticleId`.
- Avoid setState in render phases:
  - Use `queueMicrotask` to defer starting a parse outside the effect tick and prevent nested-update warnings/loops under StrictMode.

Concrete sketch

```ts
const articleRef = useRef(article);
useEffect(() => {
  articleRef.current = article;
}, [article]);

const jobsRef = useRef(
  new Map<string, "idle" | "scheduled" | "running" | "done" | "failed">()
);
const isParsingRef = useRef(false);
useEffect(() => {
  isParsingRef.current = isParsing;
}, [isParsing]);

const triggerParse = useCallback(async (isManual = false) => {
  const a = articleRef.current;
  if (!a?.url || !mountedRef.current) return;
  const job = jobsRef.current.get(a.id);
  if (
    !isManual &&
    (job === "running" || job === "scheduled" || isParsingRef.current)
  )
    return;

  jobsRef.current.set(a.id, "running");
  setIsParsing(true);
  setParseError(null);

  const controller = new AbortController();
  abortControllerRef.current?.abort();
  abortControllerRef.current = controller;
  const { id } = a;
  try {
    const res = await fetch(`/reader/api/articles/${id}/fetch-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRefresh: isManual }),
      signal: controller.signal,
    });
    if (!mountedRef.current || articleRef.current.id !== id) return;
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data?.parseFailed
          ? "Content extraction failed. The original article may no longer be available."
          : data?.message || "Failed to fetch content"
      );
    if (data?.content) setParsedContent(data.content);
    setParseError(null);
    jobsRef.current.set(id, "done");
  } catch (e: any) {
    if (
      !mountedRef.current ||
      articleRef.current.id !== id ||
      e?.name === "AbortError"
    )
      return;
    setParseError(e?.message || "An unexpected error occurred");
    jobsRef.current.set(id, "failed");
  } finally {
    if (mountedRef.current && articleRef.current.id === id) setIsParsing(false);
    abortControllerRef.current = null;
  }
}, []);

useEffect(() => {
  if (!enabled || !mountedRef.current) return;
  const a = article;
  const job = jobsRef.current.get(a.id);
  if (
    job === "running" ||
    job === "scheduled" ||
    (a.hasFullContent && a.fullContent) ||
    a.parseFailed === true
  )
    return;

  let needs = false;
  if (feed?.isPartialContent === true) needs = true;
  else if (a.content && a.content.length < 500) needs = true;
  else if (a.content) {
    const indicators = [
      "Read more",
      "Continue reading",
      "[...]",
      "Click here to read",
      "View full article",
    ];
    needs = indicators.some((i) =>
      a.content.toLowerCase().includes(i.toLowerCase())
    );
  }
  if (needs) {
    jobsRef.current.set(a.id, "scheduled");
    queueMicrotask(() => triggerParse(false));
  }
}, [
  enabled,
  article.id,
  article.content,
  article.hasFullContent,
  article.fullContent,
  article.parseFailed,
  feed?.isPartialContent,
]);
```

Notes

- This removes the subtle dependency loop and guarantees a single parse “job” per article unless manually retriggered.
- `queueMicrotask` avoids synchronous setState from within an effect, which can create cascades under React 18 dev/Strict rendering.
- The stable callback plus ref pattern is the closest to `useEvent` semantics available today.

Test guidance (to stop hangs/OOM)

- Don’t assert immediately after render. Prefer `await waitFor(() => expect(fetch).toHaveBeenCalled())`.
- Avoid mixing fake timers unless absolutely necessary. If using them:
  - `vi.useFakeTimers();` render; await operations; `await vi.runAllTimersAsync();` then `vi.useRealTimers();`.
- For delayed fetch mocks, prefer a controllable promise over `setTimeout`:

```ts
let resolveFetch: (v: any) => void;
const p = new Promise((r) => {
  resolveFetch = r;
});
(global.fetch as any).mockImplementation(() => p);
// ... trigger
resolveFetch({
  ok: true,
  json: async () => ({ success: true, content: "<p>Content</p>" }),
});
```

- In the short-content test, replace the immediate `expect(fetch).toHaveBeenCalledTimes(1)` with a `waitFor` to avoid races.

Expected outcome

- No infinite re-renders, heap remains stable, and all 11 auto-parse tests pass consistently without relying on brittle timer advances.

— Siri

---

# Claude's Follow-up (Aug 27, 5:57am)

## Implementation Status

Implemented the state machine solution as suggested:

- Created `articleRef` to sync article prop with stable callback
- Added `jobsRef` with state machine states (`idle`, `scheduled`, `running`, `done`, `failed`)
- Made `triggerParse` stable with `useCallback([])` and empty dependencies
- Removed `triggerParse` from auto-parse effect dependencies
- All state access now through refs in the stable callback

## Remaining Challenges

### 1. Auto-parse Not Triggering in Tests

Despite implementing the state machine, fetch is never called in tests that expect auto-parsing:

- Tests fail with "expected spy to be called 1 times, but got 0 times"
- The auto-parse effect runs but `triggerParse` doesn't execute fetch
- Job state correctly sets to "scheduled" but fetch never happens

### 2. Timing Issues with Direct Call vs Deferred Execution

Tried multiple approaches:

1. **With `queueMicrotask`**: Tests hang waiting for fetch that never happens
2. **With `Promise.resolve().then()`**: Same issue as queueMicrotask
3. **Direct call**: Still no fetch execution
4. **Polyfill for test environment**: No improvement

The issue persists regardless of deferral strategy.

### 3. State Synchronization Problem

When `triggerParse` is called directly from the effect:

- Job state is "scheduled"
- But the function still early returns without calling fetch
- Removing `isParsingRef.current` check didn't help
- The job state check `(job === "running" || job === "scheduled")` might be the issue

## Code Analysis

The current implementation in the auto-parse effect:

```typescript
if (needsParsing) {
  jobsRef.current.set(article.id, "scheduled");
  triggerParse(false); // Direct call
}
```

And in `triggerParse`:

```typescript
const job = jobsRef.current.get(currentArticle.id);
if (!isManual && (job === "running" || job === "scheduled")) {
  return; // This might be preventing execution
}
```

The problem: We set job to "scheduled" then immediately check if it's "scheduled" and bail out.

## Questions

1. **State Machine Logic**: Should the job state be set to "scheduled" BEFORE calling `triggerParse`, or should `triggerParse` handle all state transitions internally?

2. **Test Environment**: The tests work without memory exhaustion now, but the async nature of the stable callback seems incompatible with the test expectations. Is there a specific pattern for testing hooks with stable callbacks that execute async operations?

3. **Alternative Approach**: Would it be better to move the auto-parse logic entirely inside `triggerParse` and have the effect just call it without any job state manipulation?

4. **React 18 Considerations**: Could this be related to React 18's automatic batching or concurrent features interfering with the ref-based state machine?

Claude

---
