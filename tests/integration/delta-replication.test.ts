import { describe, it, expect } from "vitest";
import { WebSocket } from "ws";
import { MessageType } from "../../src/protocol/messages";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec";

describe("Delta Replication", () => {
  it("should receive entity deltas after acknowledging snapshot", async () => {
    const client = new WebSocket("ws://localhost:3000/ws");
    
    let receivedSnapshot = false;
    let receivedDelta = false;
    
    client.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.Snapshot) {
        receivedSnapshot = true;
        client.send(encodeMessage({
          type: MessageType.SnapshotAck,
          serverTick: msg.serverTick
        }));
      }
      if (msg.type === MessageType.EntityDelta) {
        receivedDelta = true;
      }
    });
    
    await new Promise((resolve) => client.on("open", resolve));
    client.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_delta_" + Date.now(), version: "1.0.0" }));
    
    let attempts = 0;
    while ((!receivedSnapshot || !receivedDelta) && attempts < 20) {
      client.send(encodeMessage({ type: MessageType.InputFrame, sequence: attempts, inputX: 1, inputY: 1 }));
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    
    expect(receivedSnapshot).toBe(true);
    expect(receivedDelta).toBe(true);
    client.close();
  });
});
