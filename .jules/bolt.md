# Bolt's Journal - Critical Learnings

## 2025-02-18 - Map Key Preservation for Monotonic History Pruning
**Learning:** In JavaScript/TypeScript, Map keys strictly preserve insertion order. When maintaining a bounded sliding window of state history indexed by monotonically increasing sequence keys (e.g., server ticks), `stateHistory.keys().next().value` retrieves the oldest key in O(1) time with 0 allocations. Using `Math.min(...map.keys())` creates an O(N) array via spread syntax on every iteration, leading to GC pressure and ~147x slower execution in high-frequency loops (e.g. 30Hz game tick).
**Action:** Always leverage JS Map insertion order when deleting the oldest entry from bounded sliding window caches instead of spreading keys into `Math.min`.
