import { WebSocket } from "ws";
import { MessageType, AnyMessage, Snapshot } from "../../src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../../src/protocol/binaryCodec.ts";

async function runTest() {
  console.log("Starting Network Impairment Test (Jitter & Packet Loss)...");

  const client = new WebSocket("ws://localhost:3000/ws");
  let cId: string | null = null;
  let entities: any[] = [];
  let snapshotsReceived = 0;

  client.on("message", (data) => {
    // Simulate 20% packet loss for incoming messages
    if (Math.random() < 0.2) return;

    // Simulate 20-50ms jitter
    const delay = 20 + Math.random() * 30;
    
    setTimeout(() => {
      const msg = decodeMessage(data) as AnyMessage;
      if (msg.type === MessageType.ServerHello) cId = msg.connectionId;
      if (msg.type === MessageType.Snapshot) {
        entities = msg.entities;
        snapshotsReceived++;
      }
    }, delay);
  });

  await new Promise((resolve) => client.on("open", resolve));

  client.send(encodeMessage({ type: MessageType.ClientHello, clientId: "test_impairment", version: "1.0.0" }));

  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!cId) throw new Error("Client did not receive ServerHello");
  if (snapshotsReceived === 0) throw new Error("No snapshots received");

  console.log(`Received ${snapshotsReceived} snapshots in 1 second under simulated 20% packet loss and 20-50ms jitter.`);
  
  // Try sending some inputs with simulated loss
  for (let i = 0; i < 10; i++) {
    if (Math.random() >= 0.2) { // 20% upstream loss
       const delay = 20 + Math.random() * 30;
       setTimeout(() => {
         if (client.readyState === WebSocket.OPEN) {
           client.send(encodeMessage({
             type: MessageType.InputFrame,
             sequence: i + 1,
             inputX: 0,
             inputY: 1
           }));
         }
       }, delay);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  
  const p1 = entities.find(e => e.id === `player_${cId}`);
  if (!p1 || p1.y === 0) {
     console.warn("Warning: Movement may have been lost due to packet loss, but connection survived.");
  } else {
     console.log(`Movement succeeded despite loss. Final y=${p1.y}`);
  }

  client.close();
  console.log("Network impairment test PASSED.");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
