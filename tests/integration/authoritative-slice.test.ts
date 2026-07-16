import { WebSocket } from "ws";
import { MessageType, AnyMessage, Snapshot } from "../../src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec.ts";

async function runTest() {
  console.log("Starting Authoritative Vertical Slice Test...");

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

  client1.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_1", version: "1.0.0" }));
  client2.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_2", version: "1.0.0" }));

  // Wait for ServerHello and initial snapshot
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`Client 1 assigned ID: ${c1Id}`);
  console.log(`Client 2 assigned ID: ${c2Id}`);

  if (!c1Id || !c2Id) throw new Error("Clients did not receive ServerHello");
  if (c1Entities.length !== 2 || c2Entities.length !== 2) throw new Error("Clients did not receive entities");

  console.log("Initial state verified.");

  // Send input from client 1
  client1.send(encodeMessage({
    type: MessageType.InputFrame,
    sequence: 1,
    inputX: 1,
    inputY: 0
  }));

  await new Promise(resolve => setTimeout(resolve, 500));

  const p1 = c1Entities.find(e => e.id === `player_${c1Id}`);
  const p1_seen_by_p2 = c2Entities.find(e => e.id === `player_${c1Id}`);

  if (p1.x > 0 && p1.x === p1_seen_by_p2.x) {
    console.log(`Success: Client 1 moved to x=${p1.x}, observed correctly by Client 2.`);
  } else {
    throw new Error(`State mismatch or no movement. C1: ${p1.x}, C2 sees: ${p1_seen_by_p2.x}`);
  }

  client1.close();
  client2.close();
  
  console.log("Authoritative slice test PASSED.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
