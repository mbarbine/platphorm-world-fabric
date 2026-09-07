## 2025-05-18 - JS Map Insertion Order vs. Math.min for State Pruning
**Learning:** In fixed-rate tick loops (e.g., 30Hz game loops), using `Math.min(...map.keys())` creates a new array allocation and spreads $O(N)$ arguments on every tick. Since JavaScript `Map` preserves insertion order, `map.keys().next().value` gives the oldest/minimum inserted key in $O(1)$ constant time without allocations.
**Action:** Use `map.keys().next().value` for ring-buffer pruning on monotonically increasing Map keys instead of spreading keys into `Math.min`.
