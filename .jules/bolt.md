# Bolt's Journal

## 2025-05-10 - O(1) Map Key Access for Chronological History Pruning
**Learning:** Using `Math.min(...map.keys())` creates a temporary array of all keys and iterates through them O(N) every tick. In JS `Map`, insertion order is preserved. For monotonically increasing keys (like server ticks), `.keys().next().value` retrieves the oldest key in O(1) time with zero array allocations (~600x faster).
**Action:** When pruning chronological Map histories, always use `.keys().next().value` instead of spreading keys into `Math.min(...)`.
