import { MessageType } from "./src/protocol/messages.ts";
import { encodeMessage, decodeMessage } from "./src/protocol/binaryCodec.ts";

const msg = { type: MessageType.SnapshotAck, serverTick: 42 };
const enc = encodeMessage(msg as any);
console.log(enc);
console.log(decodeMessage(enc));
