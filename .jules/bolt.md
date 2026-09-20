## 2026-09-01 - Avoid allocating Uint8Array instances during binary encoding loop

**Learning:** Calling `TextEncoder.prototype.encode()` inside a loop over dynamic entity states creates intermediate `Uint8Array` objects per entity per tick, generating heavy GC pressure and slowing binary serialization down by >50%.
**Action:** Use a fast string byte length helper to compute total message length up front, then use `TextEncoder.prototype.encodeInto()` directly into the target `Uint8Array` buffer.

## 2026-09-02 - Eliminate redundant intermediate Uint8Array allocations in binary encoding

**Learning:** Pre-allocating temporary Uint8Array arrays during packet length calculation generates unnecessary GC pressure when `TextEncoder.prototype.encodeInto()` is already used in the serialization write loop.
**Action:** Calculate string byte lengths using a zero-allocation byte length function during the sizing pass, then stream directly into the target Uint8Array buffer slice with `encodeInto()`.
