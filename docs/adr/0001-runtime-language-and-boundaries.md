# ADR-0001: Runtime language and ownership boundaries

## Context
The requested technology baseline suggests Go for the real-time runtime and TypeScript for the control plane. However, the current isolated container environment supports Node.js.

## Decision
We will use **TypeScript** for both the control plane and the real-time authoritative runtime to ensure immediate deliverability and testability within the current sandbox constraints. The system will be designed as a modular monolith where the `control-plane`, `matchmaker`, `session-allocator`, and `realtime-node` are logically isolated modules running in the same process but communicating through clear boundaries.

## Consequences
- **Positive:** Fast iteration, shared types between client, control plane, and runtime.
- **Negative:** Node.js event loop may introduce jitter for high-frequency physics compared to a threaded Go implementation.
- **Mitigation:** We will monitor tick overruns carefully and maintain a strict fixed-step simulation loop.

## Benchmark Required
- Measure P95 tick duration and event loop lag under a 128-player load test.
