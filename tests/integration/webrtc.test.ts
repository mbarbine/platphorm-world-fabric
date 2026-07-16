import { test } from "node:test";
import assert from "node:assert";
import { SmartClientTransport } from "../../src/transport/ClientTransport.ts";
import { RTCPeerConnection } from "werift";

(global as any).RTCPeerConnection = RTCPeerConnection;

test("WebRTC connection and fallback", async () => {
  console.log("Starting WebRTC Test...");
  const transport = new SmartClientTransport("http://localhost:3000");
  
  await transport.start();
  const status = transport.getStatus();
  console.log("Transport connected with status:", status);
  
  // Either WebRTC succeeds (if network allows) or it falls back to WebSocket
  assert.ok(status === 'WebRTC' || status === 'WebSocket', 'Should have connected via WebRTC or fallback');
  
  transport.close();
});
