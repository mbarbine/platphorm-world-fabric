import { WebSocket } from "ws";
import { MessageType, AnyMessage, Snapshot } from "../../src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec.ts";

async function runTest() {
  console.log("Starting Interest Filtering Test...");

  const client1 = new WebSocket("ws://localhost:3000/ws");
  const client2 = new WebSocket("ws://localhost:3000/ws");

  let c1Id: string | null = null;
  let c2Id: string | null = null;
  let c1Entities: any[] = [];
  let c2Entities: any[] = [];

  const awaitConnection = (ws: WebSocket) => new Promise((resolve) => {
    ws.on("open", resolve);
  });

  client1.on("message", (data) => {
    const msg = decodeMessage(data) as AnyMessage;
    if (msg.type === MessageType.ServerHello) c1Id = msg.connectionId;
    if (msg.type === MessageType.Snapshot) c1Entities = msg.entities;
  });

  client2.on("message", (data) => {
    const msg = decodeMessage(data) as AnyMessage;
    if (msg.type === MessageType.ServerHello) c2Id = msg.connectionId;
    if (msg.type === MessageType.Snapshot) c2Entities = msg.entities;
  });

  await Promise.all([awaitConnection(client1), awaitConnection(client2)]);
  console.log("Both clients connected.");

  const c1ClientId = "test_if_1_" + Date.now();
  const c2ClientId = "test_if_2_" + Date.now();

  client1.send(encodeMessage({ type: MessageType.ClientHello, clientId: c1ClientId, version: "1.0.0" }));
  client2.send(encodeMessage({ type: MessageType.ClientHello, clientId: c2ClientId, version: "1.0.0" }));

  // Wait for initial sync
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Move client 2 far away (> 1000 pixels)
  // At speed 5 per input frame, 1 input frame per server tick is maximum if they spam.
  // Actually, we can just send multiple inputs and wait.
  for (let i = 0; i < 210; i++) {
    client2.send(encodeMessage({
      type: MessageType.InputFrame,
      sequence: i,
      inputX: 1,
      inputY: 0
    }));
    await new Promise(resolve => setTimeout(resolve, 20)); // wait slightly
  }

  // Wait for state to settle
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const c2Self = c2Entities.find(e => e.id === `player_${c2Id}`);
  console.log(`Client 2 moved to x=${c2Self?.x}`);

  // Client 1 should no longer see Client 2
  const c2AsSeenByC1 = c1Entities.find(e => e.id === `player_${c2Id}`);
  if (c2AsSeenByC1) {
    throw new Error(`Client 1 can still see Client 2 at x=${c2AsSeenByC1.x}, but it should be filtered out!`);
  } else {
    console.log("Success: Client 2 is filtered out from Client 1's snapshot.");
  }
  
  client1.close();
  client2.close();
  
  console.log("Interest filtering test PASSED.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
