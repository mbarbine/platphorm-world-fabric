## 2025-05-18 - Map Key Eviction vs Math.min Spread Optimization
**Learning:** Spread-element argument passing like `Math.min(...map.keys())` creates temporary arrays and runs in O(N) time for history buffer eviction every server tick. Since JS `Map` maintains insertion order and tick keys increase monotonically, `map.keys().next().value` retrieves the oldest tick key in O(1) time without array allocations.
**Action:** Use `map.keys().next().value` for FIFO buffer eviction on JavaScript `Map`s.
