import { AnyMessage, MessageType, EntityState } from './messages.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeMessage(msg: AnyMessage): Uint8Array {
  if (msg.type === MessageType.InputFrame) {
    const buf = new Uint8Array(13);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setUint32(1, msg.sequence, true);
    view.setFloat32(5, msg.inputX, true);
    view.setFloat32(9, msg.inputY, true);
    return buf;
  }
  
  if (msg.type === MessageType.Ping) {
    const buf = new Uint8Array(9);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setFloat64(1, msg.clientTime, true);
    return buf;
  }

  if (msg.type === MessageType.Pong) {
    const buf = new Uint8Array(17);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setFloat64(1, msg.clientTime, true);
    view.setFloat64(9, msg.serverTime, true);
    return buf;
  }

  if (msg.type === MessageType.Snapshot) {
    // Variable length
    let size = 1 + 4 + 2; // type + tick + count
    const encodedIds = msg.entities.map(e => textEncoder.encode(e.id));
    for (const eid of encodedIds) {
      size += 2 + eid.length + 4 + 4; // idLength + idBytes + x + y
    }
    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setUint32(1, msg.serverTick, true);
    view.setUint16(5, msg.entities.length, true);
    
    let offset = 7;
    for (let i = 0; i < msg.entities.length; i++) {
      const e = msg.entities[i];
      const eid = encodedIds[i];
      view.setUint16(offset, eid.length, true);
      offset += 2;
      buf.set(eid, offset);
      offset += eid.length;
      view.setFloat32(offset, e.x, true);
      view.setFloat32(offset + 4, e.y, true);
      offset += 8;
    }
    return buf;
  }

  // Fallback indicator
  const str = JSON.stringify(msg);
  const textBytes = textEncoder.encode(str);
  const buf = new Uint8Array(1 + textBytes.length);
  buf[0] = 0xFF; // Fallback
  buf.set(textBytes, 1);
  return buf;
}

export function decodeMessage(data: Uint8Array | ArrayBuffer | any): AnyMessage {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const type = view.getUint8(0);

  if (type === 0xFF) {
    const str = textDecoder.decode(buf.subarray(1));
    return JSON.parse(str);
  }

  if (type === MessageType.InputFrame) {
    return {
      type: MessageType.InputFrame,
      sequence: view.getUint32(1, true),
      inputX: view.getFloat32(5, true),
      inputY: view.getFloat32(9, true)
    };
  }
  
  if (type === MessageType.Ping) {
    return {
      type: MessageType.Ping,
      clientTime: view.getFloat64(1, true)
    };
  }

  if (type === MessageType.Pong) {
    return {
      type: MessageType.Pong,
      clientTime: view.getFloat64(1, true),
      serverTime: view.getFloat64(9, true)
    };
  }

  if (type === MessageType.Snapshot) {
    const serverTick = view.getUint32(1, true);
    const count = view.getUint16(5, true);
    const entities: EntityState[] = [];
    let offset = 7;
    for (let i = 0; i < count; i++) {
      const idLen = view.getUint16(offset, true);
      offset += 2;
      const id = textDecoder.decode(buf.subarray(offset, offset + idLen));
      offset += idLen;
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      offset += 8;
      entities.push({ id, x, y });
    }
    return {
      type: MessageType.Snapshot,
      serverTick,
      entities
    };
  }

  throw new Error("Unknown message type: " + type);
}
