import { WebSocket } from "ws";
import { MessageType, AnyMessage, Snapshot, EntityDeltaMessage } from "../../src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec.ts";

async function runTest() {
  console.log("Starting Delta Replication Test...");
  const client1 = new WebSocket("ws://localhost:3000/ws");
  const CLIENT_ID = "test_delta_1_" + Date.now();

  let connectionId: string | null = null;
  let receivedSnapshot = false;
  let receivedDelta = false;

  const awaitConnection = (ws: WebSocket) => new Promise((resolve) => {
    ws.on("open", resolve);
  });

  client1.on("message", (data) => {
    const msg = decodeMessage(data as Uint8Array) as AnyMessage;
    
    if (msg.type === MessageType.ServerHello) {
      connectionId = msg.connectionId;
    }
    
    if (msg.type === MessageType.Snapshot) {
      receivedSnapshot = true;
      // Send ack
      client1.send(encodeMessage({
        type: MessageType.SnapshotAck,
        serverTick: msg.serverTick
      }));
    }

    if (msg.type === MessageType.EntityDelta) {
      if (!receivedDelta) {
        console.log(`Received first EntityDelta based on tick ${msg.baselineTick} with ${msg.updates.length} updates`);
        receivedDelta = true;
      }
    }
  });

  await awaitConnection(client1);
  console.log("Client connected.");

  client1.send(encodeMessage({ type: MessageType.ClientHello, clientId: CLIENT_ID, version: "1.0.0" }));

  // Wait for initial sync and some updates
  let attempts = 0;
  while ((!receivedSnapshot || !receivedDelta) && attempts < 20) {
    client1.send(encodeMessage({
      type: MessageType.InputFrame,
      sequence: attempts,
      inputX: 1,
      inputY: 1
    }));
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }

  if (!receivedSnapshot) throw new Error("Did not receive any Snapshots");
  if (!receivedDelta) throw new Error("Did not receive any EntityDeltas after Ack");

  client1.close();
  console.log("Delta replication test PASSED.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
