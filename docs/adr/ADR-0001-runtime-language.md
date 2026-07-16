# ADR-0001: Runtime Language and Ownership Boundaries

## Context
The Platphorm Realtime World Fabric launch directive prescribes a baseline stack including Go for the authoritative Real-Time Runtime (signaling, WebRTC, authoritative loop) unless existing evidence supports a better choice. Given the aggressive 128-day timeline, a single-language ecosystem (TypeScript/Node.js) significantly minimizes context switching and allows shared, strongly-typed code (protocol, message codecs, simulation components) between the browser SDK, server control plane, and the authoritative runtime.

## Decision
We will use **Node.js (TypeScript)** for the Authoritative Realtime Runtime instead of Go.

## Boundaries
- `web`: Next.js / Vite React frontend handling rendering and local prediction.
- `control-plane`: Express API handling Lobby orchestration, Matchmaking, and HTTP entrypoints.
- `runtime`: The Node.js WebSocket/WebRTC layer executing the fixed-step game loop (30Hz), managing physics, entity authority, spatial relevance filtering, and replication.

## Consequences
- **Positive**: Seamless code sharing. The binary codec and entity schema are 100% shared without Protobuf/gRPC bridging overhead during early cycles.
- **Negative**: Node.js has unpredictable garbage collection pauses and event loop blocking, which may introduce jitter. Native WebRTC bindings in Node.js are less robust than Pion WebRTC in Go.
- **Mitigation**: We will strict-profile tick durations. If Node.js event-loop delays exceed 1-5ms consistently under the load test profiles, we will isolate the `runtime` to a dedicated worker thread or rewrite the `runtime` specifically in Go at a later Gate.

## Benchmark Evidence Required
The runtime must comfortably support the 128-player reference workload at 30Hz with < 1% tick overruns.

## Reversal Strategy
If Node.js fails the load tests, the protocol schema (`binaryCodec.ts`) cleanly abstracts the wire format, allowing the `runtime` to be independently rewritten in Go.
