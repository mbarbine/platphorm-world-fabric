## 2025-05-18 - String ID Encoding Memoization in Hot Serialization Loops
**Learning:** In real-time tick-based network serialization (snapshots & deltas), repeatedly calling `TextEncoder.encode(stringId)` creates huge amounts of temporary `Uint8Array` objects and triggers frequent GC pauses. Caching entity ID byte arrays in a bounded Map avoids allocations and cuts encoding time significantly.
**Action:** Always memoize UTF-8 string encoding for recurring entity/session keys in high-frequency binary codecs.
