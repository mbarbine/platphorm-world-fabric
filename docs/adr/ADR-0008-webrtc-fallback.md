# ADR-0008: WebRTC and Fallback Transport Strategy

## Context
The platform requires low-latency, sequence-aware transport for hot-path game replication. The directive specifies WebRTC data channels as the primary transport and WebSocket as a fallback.

## Decision
We will implement a unified `SmartClientTransport` abstraction in the browser SDK that encapsulates both WebRTC Data Channels and WebSockets.
1. The client will attempt WebRTC signaling (`/webrtc-signaling`).
2. If WebRTC negotiation times out (5 seconds), or ICE connection fails due to strict NAT/firewalls, the transport will seamlessly fall back to `WebSocketClientTransport`.
3. Both transports use identical logical data flows (binary `ArrayBuffer` encoded messages) so the authoritative simulation layer (`TransportChannel`) never knows or cares which physical transport is being used.

## Consequences
- **Positive**: Guarantees playability across restrictive corporate networks or strict school firewalls where UDP traffic is blocked.
- **Negative**: Adds complexity to the connection phase, introducing a potential 5s latency to start the game if WebRTC drops.

## Future Benchmark Evidence Required
Measure WebRTC failure rates in production telemetry. Maintain 99.5% connection success rate by using the fallback effectively.
