## 2026-09-01 - Avoid allocating Uint8Array instances during binary encoding loop

**Learning:** Calling `TextEncoder.prototype.encode()` inside a loop over dynamic entity states creates intermediate `Uint8Array` objects per entity per tick, generating heavy GC pressure and slowing binary serialization down by >50%.
**Action:** Use a fast string byte length helper to compute total message length up front, then use `TextEncoder.prototype.encodeInto()` directly into the target `Uint8Array` buffer.

## 2026-09-02 - Inline interest filtering loops in tick replication to avoid garbage collection pressure

**Learning:** Calling `Array.from(map.values())` and `.filter()` in a high-frequency (30Hz) game loop creates hundreds of temporary arrays and closure callbacks per second for connected clients, causing GC pauses.
**Action:** Iterate over `map.values()` directly with single-pass `for...of` loops and inline interest boundary conditions.

## 2026-09-03 - Memoize SVG chart components when parent component state updates at high frequency (30Hz)

**Learning:** In realtime game/telemetry applications where game entity state updates at 30Hz, rendering Recharts SVG components directly inside the top-level parent component causes all charts to re-render 30 times a second (120 chart renders/sec), even when telemetry data only updates at 1Hz.
**Action:** Extract Recharts chart trees into dedicated `React.memo` components so React skips VDOM reconciliation when history array references remain unchanged between 1-second telemetry intervals.

## 2026-09-04 - Avoid temporary typed array allocations in hot binary encoding loops

**Learning:** Allocating a temporary `Int32Array` or `Array` inside hot serialization functions to cache string lengths introduces heap allocation and GC pressure that outweighs simple inline string length checks.
**Action:** Keep string byte-length calculations inline or re-use a module-scoped buffer when serializing binary packets in hot loops.

## 2026-09-05 - Fast ASCII string decoding and pre-allocation for high-frequency binary state replication

**Learning:** Calling `TextDecoder.prototype.decode(buf.subarray(...))` and `Array.prototype.push()` inside high-frequency binary packet decoding loops (30Hz replication snapshots) causes heavy garbage collection pressure due to temporary Uint8Array view allocations and dynamic array growth.
**Action:** Use an inline fast-path ASCII byte decoder for short strings (<64 bytes) and pre-allocate fixed-capacity arrays (`new Array(count)`) when parsing binary snapshots and delta updates.

## 2026-09-06 - Avoid Uint8Array subarray view allocations in hot binary string encoding

**Learning:** Passing `buf.subarray(offset, offset + len)` into `TextEncoder.prototype.encodeInto()` inside high-frequency serialization loops creates temporary Uint8Array view objects for every string field on every tick (30Hz), generating GC pressure and redundant byte length recalculations.
**Action:** Use an inline ASCII string encoder that writes character codes directly into the destination buffer byte-by-byte for ASCII strings, falling back to `encodeInto` only when non-ASCII bytes are encountered.

## 2026-09-07 - Maintain incremental state counters and bounded sample buffers for API metrics endpoints

**Learning:** Iterating over all lifetime objects in a Map and sorting historical numeric samples (e.g. ticket wait times) on every 1-second HTTP metrics request degrades endpoint latency from O(1) to O(N log N) as the system processes thousands of items over time.
**Action:** Maintain incremental state counters on object creation/transition and accumulate metrics samples in a bounded rolling buffer (e.g. max 200 items) to keep metrics calculations O(1).

## 2026-09-08 - Replace DataView allocations with direct bitwise byte operations and module-scoped scratch buffers

**Learning:** Creating `new DataView(buf.buffer)` on every binary packet encode/decode operation in hot network loops (30Hz snapshots/inputs) creates hundreds of thousands of heap-allocated wrapper objects per second, adding ~42% serialization overhead and heavy GC pressure.
**Action:** Use inline bitwise operations for little-endian integer reads/writes and a module-scoped 8-byte `ArrayBuffer` with `Float32Array`/`Uint8Array` views for floating-point bit conversions.

## 2026-09-09 - Avoid caching handler array lengths in event dispatch loops where callbacks may unsubscribe

**Learning:** Caching `handlers.length` in a `for` loop before invoking callbacks (e.g. `messageHandlers[i](data)`) causes a runtime `TypeError: handler is not a function` if an event listener unsubscribes or mutates the handler array mid-dispatch.
**Action:** Keep standard `for...of` loops or evaluate `.length` dynamically on dynamic callback arrays during event iteration.

## 2026-09-10 - Use module-scoped scratch arrays for fast ASCII string decoding and length checks

**Learning:** Concatenating string characters in a loop (`str += String.fromCharCode(b)`) during binary decoding creates intermediate string objects for each byte, adding GC overhead and slowing down packet decoding.
**Action:** Populate a module-scoped scratch array and call `String.fromCharCode.apply(null, charCodeScratch)` to construct strings in a single C++ call (~32% faster), and use a single-pass ASCII loop for `getStringByteLength` (~30% faster).

## 2026-09-11 - Single-pass binary snapshot encoding with resizable scratch buffer

**Learning:** Pre-calculating binary message buffer sizes by iterating over all entities and evaluating string byte lengths before allocation introduces a 2x loop pass overhead per replication tick (30Hz).
**Action:** Encode binary snapshot and delta messages directly into a resizable module-scoped `outputScratch` buffer in a single pass, then return `outputScratch.slice(0, offset)` (~25% speedup).
