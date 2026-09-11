## 2025-05-18 - JS Map Insertion Order in State History Buffer
**Learning:** `stateHistory` stores tick snapshots keyed by monotonically increasing integers. Using `Math.min(...map.keys())` creates a new array and spreads arguments on every frame, which is O(N) memory allocation and processing overhead in 30Hz game loops. Since ES6 Maps maintain insertion order, `map.keys().next().value` yields the oldest key in O(1) time without garbage creation.
**Action:** Always prefer `map.keys().next().value` over `Math.min(...map.keys())` when pruning FIFO buffers backed by JS Maps.
