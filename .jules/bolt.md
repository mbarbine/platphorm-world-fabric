## 2025-05-18 - Avoid Math.min(...map.keys()) spread in tick loops
**Learning:** In hot loops (e.g. 30Hz game tick loops), `Math.min(...map.keys())` creates an array of keys and spreads parameters into `Math.min()`, incurring $O(N)$ overhead and GC allocations every frame. Since JS `Map` preserves insertion order and keys like `serverTick` are monotonically increasing, `map.keys().next().value` returns the oldest key in $O(1)$ constant time with 0 allocations.
**Action:** Use `map.keys().next().value` for Map FIFO eviction in fixed-step time series or tick history buffers.
