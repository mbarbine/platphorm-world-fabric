import { WebSocket } from "ws";
import { MessageType, AnyMessage } from "../../src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec.ts";

async function runTest() {
  console.log("Starting Reconnection Test...");
  const CLIENT_ID = "reconnect_test_client_" + Date.now();

  let c1Entities: any[] = [];
  let connectionId: string | null = null;

  const connectClient = async () => {
    const ws = new WebSocket("ws://localhost:3000/ws");
    
    ws.on("message", (data) => {
      const msg = decodeMessage(data as Uint8Array) as AnyMessage;
      if (msg.type === MessageType.ServerHello) connectionId = msg.connectionId;
      if (msg.type === MessageType.Snapshot) c1Entities = msg.entities;
    });

    await new Promise((resolve) => ws.on("open", resolve));
    ws.send(encodeMessage({ type: MessageType.ClientHello, clientId: CLIENT_ID, version: "1.0.0" }));
    
    // Wait for ServerHello and a Snapshot
    await new Promise(resolve => setTimeout(resolve, 500));
    return ws;
  };

  // 1. Initial Connection
  let client = await connectClient();
  if (connectionId !== CLIENT_ID) throw new Error(`Connection ID did not match requested client ID. Expected ${CLIENT_ID}, got ${connectionId}`);
  
  // 2. Move
  client.send(encodeMessage({
    type: MessageType.InputFrame,
    sequence: 1,
    inputX: 10,
    inputY: 0
  }));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const entityBeforeDisconnect = c1Entities.find(e => e.id === `player_${CLIENT_ID}`);
  console.log(`Before disconnect, X: ${entityBeforeDisconnect.x}`);
  const expectedX = entityBeforeDisconnect.x;

  // 3. Disconnect
  client.close();
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("Client disconnected.");

  // 4. Reconnect
  client = await connectClient();
  
  const entityAfterReconnect = c1Entities.find(e => e.id === `player_${CLIENT_ID}`);
  console.log(`After reconnect, X: ${entityAfterReconnect.x}`);

  if (entityAfterReconnect.x !== expectedX) {
    throw new Error(`State mismatch! Expected X=${expectedX}, got X=${entityAfterReconnect.x}`);
  }

  console.log("Success: State was perfectly preserved across reconnection.");
  
  client.close();
  console.log("Reconnect test PASSED.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
