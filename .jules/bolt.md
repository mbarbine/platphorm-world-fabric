## 2026-09-01 - Avoid allocating Uint8Array instances during binary encoding loop

**Learning:** Calling `TextEncoder.prototype.encode()` inside a loop over dynamic entity states creates intermediate `Uint8Array` objects per entity per tick, generating heavy GC pressure and slowing binary serialization down by >50%.
**Action:** Use a fast string byte length helper to compute total message length up front, then use `TextEncoder.prototype.encodeInto()` directly into the target `Uint8Array` buffer.

## 2026-09-02 - Inline interest filtering loops in tick replication to avoid garbage collection pressure

**Learning:** Calling `Array.from(map.values())` and `.filter()` in a high-frequency (30Hz) game loop creates hundreds of temporary arrays and closure callbacks per second for connected clients, causing GC pauses.
**Action:** Iterate over `map.values()` directly with single-pass `for...of` loops and inline interest boundary conditions.
