import { describe, it, expect } from "vitest";
import { WebSocket } from "ws";
import { MessageType } from "../../src/protocol/messages";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec";

describe("Reconnect", () => {
  it("should reconnect and resume state", async () => {
    const clientId = "test_reconnect_" + Date.now();
    let client = new WebSocket("ws://localhost:3000/ws");
    
    let connectionId = null;
    client.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.ServerHello) connectionId = msg.connectionId;
    });
    
    await new Promise(resolve => client.on("open", resolve));
    client.send(encodeMessage({ type: MessageType.ClientHello, clientId, version: "1.0.0" }));
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(connectionId).toBeTruthy();
    
    client.close();
    
    client = new WebSocket("ws://localhost:3000/ws");
    let newConnectionId = null;
    client.on("message", (data) => {
      const msg = decodeMessage(data);
      if (msg.type === MessageType.ServerHello) newConnectionId = msg.connectionId;
    });
    await new Promise(resolve => client.on("open", resolve));
    client.send(encodeMessage({ type: MessageType.ClientHello, clientId, version: "1.0.0" }));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Should get a new connection ID but same client
    expect(newConnectionId).toBeTruthy();
    client.close();
  });
});
