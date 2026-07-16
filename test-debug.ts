import { WebSocket } from "ws";
import { MessageType, AnyMessage } from "./src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "./src/protocol/binaryCodec.ts";

const CLIENT_ID = "reconnect_test_client";
const ws = new WebSocket("ws://localhost:3000/ws");
ws.on("message", (data) => {
  const msg = decodeMessage(data as Uint8Array) as AnyMessage;
  console.log("Received:", msg.type, msg);
});
ws.on("open", () => {
  const msg = { type: MessageType.ClientHello, clientId: CLIENT_ID, version: "1.0.0" };
  console.log("Open, sending ClientHello", msg);
  console.log("Encoded:", encodeMessage(msg as any));
  ws.send(encodeMessage(msg as any));
});
setTimeout(() => ws.close(), 2000);
