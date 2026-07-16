import { describe, it, expect } from "vitest";
import { WebSocket } from "ws";
import { MessageType } from "../../src/protocol/messages";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec";

describe("Interest Filtering", () => {
  it("should only send relevant entities based on distance", async () => {
    const client = new WebSocket("ws://localhost:3000/ws");
    let entities = [];
    
    client.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.Snapshot) entities = msg.entities;
    });
    
    await new Promise(resolve => client.on("open", resolve));
    client.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_interest_" + Date.now(), version: "1.0.0" }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // There shouldn't be hundreds of entities, it should be filtered
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.length).toBeLessThan(100);
    client.close();
  });
});
