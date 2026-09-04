## 2025-05-18 - Map Iterator for Monotonic Tick History Cleanup
**Learning:** Using `Math.min(...map.keys())` to find the oldest entry in a monotonically increasing Map causes $O(N)$ scanning and unnecessary array allocations on every tick (30Hz). Since ES6 Maps preserve insertion order, `map.keys().next().value` provides the oldest key in $O(1)$ constant time with zero array allocations.
**Action:** Always prefer `map.keys().next().value` over `Math.min(...map.keys())` when pruning fixed-size time-series Map caches.
