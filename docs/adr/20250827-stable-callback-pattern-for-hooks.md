# ADR: Stable Callback Pattern for React Hooks

**Date:** 2025-08-27
**Status:** Accepted
**Context:** RR-245 Memory Exhaustion Fix

## Decision

We will use a stable callback pattern with refs for complex React hooks that manage async operations to prevent dependency cycles and infinite re-renders.

## Context

The `useAutoParseContent` hook experienced memory exhaustion due to a circular dependency:
- The `triggerParse` callback depended on `isParsing` state
- The auto-parse effect depended on `triggerParse`
- When `isParsing` changed, `triggerParse` was recreated, triggering the effect again
- This created an infinite loop causing memory exhaustion in tests

## Solution Pattern

### 1. Stable Callback with Empty Dependencies

```typescript
const triggerParse = useCallback(async (isManual = false) => {
  const currentArticle = articleRef.current;
  const isParsing = isParsingRef.current;
  // All state accessed via refs
}, []); // Empty dependencies for stable identity
```

### 2. State Synchronization via Refs

```typescript
const [isParsing, setIsParsing] = useState(false);
const isParsingRef = useRef(false);

useEffect(() => {
  isParsingRef.current = isParsing;
}, [isParsing]);
```

### 3. Job State Machine

```typescript
type JobState = "idle" | "running" | "done" | "failed";
const jobsRef = useRef(new Map<string, JobState>());
```

### 4. URL-Based Tracking

Track operations by URL instead of ID since article objects can be recreated with new IDs but same URLs.

### 5. Cooldown Mechanism

```typescript
const lastTriggerKeyRef = useRef<string | null>(null);
const lastTriggerAtRef = useRef<number>(0);

if (lastTriggerKeyRef.current === key && now - lastTriggerAtRef.current < 100) {
  return; // Prevent burst re-triggers
}
```

## Benefits

- **No dependency cycles**: Callbacks remain stable across renders
- **Better performance**: Reduces unnecessary re-renders
- **Predictable behavior**: State machine prevents invalid state transitions
- **Test stability**: Eliminates timing issues and memory exhaustion

## Consequences

- **More complex code**: Requires careful management of refs
- **Learning curve**: Developers need to understand the ref pattern
- **Debugging challenges**: State in refs is harder to inspect than regular state

## Alternatives Considered

1. **useEvent RFC pattern**: Not yet available in stable React
2. **Dependency arrays with all deps**: Causes infinite re-renders
3. **useMemo for callbacks**: Doesn't guarantee stable identity

## Implementation Guidelines

When implementing this pattern:

1. Create refs for all state that callbacks need to access
2. Sync refs with state using minimal effects
3. Use empty dependency arrays for callbacks that should be stable
4. Track operations by stable identifiers (URLs, not object IDs)
5. Add cooldown mechanisms for operations triggered by parent re-renders

## References

- PR #45: Auto-parse memory exhaustion fix
- Issue RR-245: Fix failing auto-parse content tests
- React RFC: useEvent Hook (future consideration)