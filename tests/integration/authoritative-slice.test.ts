import { describe, it, expect } from "vitest";
import { WebSocket } from "ws";
import { MessageType, AnyMessage } from "../../src/protocol/messages";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec";

describe("Authoritative Slice", () => {
  it("should connect, receive state and observe movement", async () => {
    const client1 = new WebSocket("ws://localhost:3000/ws");
    const client2 = new WebSocket("ws://localhost:3000/ws");
    
    let c1Id = null;
    let c2Id = null;
    let c1Entities = [];
    let c2Entities = [];
    
    const awaitConnection = (ws) => new Promise((resolve) => ws.on("open", resolve));
    
    client1.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.ServerHello) c1Id = msg.connectionId;
      if (msg.type === MessageType.Snapshot) c1Entities = msg.entities;
    });
    
    client2.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.ServerHello) c2Id = msg.connectionId;
      if (msg.type === MessageType.Snapshot) c2Entities = msg.entities;
    });
    
    await Promise.all([awaitConnection(client1), awaitConnection(client2)]);
    
    client1.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_auth_1_" + Date.now(), version: "1.0.0" }));
    client2.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_auth_2_" + Date.now(), version: "1.0.0" }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(c1Id).toBeTruthy();
    expect(c2Id).toBeTruthy();
    expect(c1Entities.length).toBeGreaterThanOrEqual(2);
    expect(c2Entities.length).toBeGreaterThanOrEqual(2);
    
    client1.send(encodeMessage({
      type: MessageType.InputFrame,
      sequence: 1,
      inputX: 1,
      inputY: 0
    }));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const p1 = c1Entities.find(e => e.id === `player_${c1Id}`);
    const p1_seen_by_p2 = c2Entities.find(e => e.id === `player_${c1Id}`);
    
    expect(p1).toBeDefined();
    expect(p1_seen_by_p2).toBeDefined();
    expect(p1.x).toEqual(p1_seen_by_p2.x);
    
    client1.close();
    client2.close();
  });
});
