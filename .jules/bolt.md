# Bolt's Journal

## 2025-05-18 - Fast Map cleanup in 30Hz game tick loop
**Learning:** JS `Map` maintains insertion order. When tracking historical snapshots by monotonically increasing tick numbers, `stateHistory.keys().next().value` retrieves the oldest key in O(1) time without allocating temporary arrays or using `Math.min(...keys)`.
**Action:** Prefer `map.keys().next().value` for Map-backed FIFO queues or sliding window caches instead of array spreading `Math.min(...map.keys())`.
