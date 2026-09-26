## 2026-09-01 - Avoid allocating Uint8Array instances during binary encoding loop

**Learning:** Calling `TextEncoder.prototype.encode()` inside a loop over dynamic entity states creates intermediate `Uint8Array` objects per entity per tick, generating heavy GC pressure and slowing binary serialization down by >50%.
**Action:** Use a fast string byte length helper to compute total message length up front, then use `TextEncoder.prototype.encodeInto()` directly into the target `Uint8Array` buffer.

## 2026-09-02 - Inline interest filtering loops in tick replication to avoid garbage collection pressure

**Learning:** Calling `Array.from(map.values())` and `.filter()` in a high-frequency (30Hz) game loop creates hundreds of temporary arrays and closure callbacks per second for connected clients, causing GC pauses.
**Action:** Iterate over `map.values()` directly with single-pass `for...of` loops and inline interest boundary conditions.

## 2026-09-03 - Memoize SVG chart components when parent component state updates at high frequency (30Hz)

**Learning:** In realtime game/telemetry applications where game entity state updates at 30Hz, rendering Recharts SVG components directly inside the top-level parent component causes all charts to re-render 30 times a second (120 chart renders/sec), even when telemetry data only updates at 1Hz.
**Action:** Extract Recharts chart trees into dedicated `React.memo` components so React skips VDOM reconciliation when history array references remain unchanged between 1-second telemetry intervals.
