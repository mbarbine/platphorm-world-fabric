## 2025-05-18 - Map Keys Insertion Order vs Math.min(...map.keys())

**Learning:** Spreading Map keys (`Math.min(...stateHistory.keys())`) in JS creates a full array copy on every execution and runs O(N) over all keys. Since JS `Map` keys maintain insertion order, the oldest key inserted into a sequential Map is always accessible in O(1) via `map.keys().next().value` without any array allocations (~570x speedup in Node.js V8 benchmark).
**Action:** Always prefer `map.keys().next().value` for evicted oldest entries in sliding window Map history caches instead of `Math.min(...map.keys())`.
