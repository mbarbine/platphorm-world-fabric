## 2026-09-05 - Direct Key Pruning vs Math.min in Tick Loops

**Learning:** In fixed-step tick loops where sequential integer keys are used (e.g. `serverTick`), using `Math.min(...map.keys())` to prune state history causes $O(N)$ key array allocations and iteration on every tick. Direct calculation `map.delete(serverTick - HISTORY_WINDOW)` is $O(1)$ and garbage-free.

**Action:** Prefer direct indexed/tick lookup over spreading iterators or `Math.min()`/`Math.max()` in fixed-interval server loops.
