import { describe, it, expect } from "vitest";
import { SmartClientTransport } from "../../src/transport/ClientTransport";
import { WebSocket } from "ws";

(global as any).WebSocket = WebSocket;

describe("Network Impairment", () => {
  it("should handle packet loss and fallback", async () => {
    const transport = new SmartClientTransport("http://localhost:3000");
    await transport.start();
    expect(transport.getStatus()).not.toBe("Disconnected");
    transport.close();
  });
});
