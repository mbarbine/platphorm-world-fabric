import { describe, it, expect } from "vitest";
import { SmartClientTransport } from "../../src/transport/ClientTransport";
import { RTCPeerConnection } from "werift";
import { WebSocket } from "ws";

(global as any).RTCPeerConnection = RTCPeerConnection;
(global as any).WebSocket = WebSocket;

describe("WebRTC", () => {
  it("should connect via fallback when werift is limited", async () => {
    const transport = new SmartClientTransport("http://localhost:3000");
    await transport.start();
    const status = transport.getStatus();
    expect(["WebRTC", "WebSocket"]).toContain(status);
    transport.close();
  });
});
