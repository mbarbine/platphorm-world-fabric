import { AnyMessage, MessageType, EntityState, EntityDeltaState } from './messages.js';

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

  if (msg.type === MessageType.SnapshotAck) {
    const buf = new Uint8Array(5);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setUint32(1, msg.serverTick, true);
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

  if (msg.type === MessageType.EntityDelta) {
    let size = 1 + 4 + 4 + 2; // type + serverTick + baselineTick + count
    const encodedIds = msg.updates.map(u => textEncoder.encode(u.id));
    for (let i = 0; i < msg.updates.length; i++) {
      const u = msg.updates[i];
      size += 2 + encodedIds[i].length + 1; // idLen + idBytes + bitmask
      if (u.x !== undefined) size += 4;
      if (u.y !== undefined) size += 4;
    }

    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    view.setUint8(0, msg.type);
    view.setUint32(1, msg.serverTick, true);
    view.setUint32(5, msg.baselineTick, true);
    view.setUint16(9, msg.updates.length, true);
    
    let offset = 11;
    for (let i = 0; i < msg.updates.length; i++) {
      const u = msg.updates[i];
      const eid = encodedIds[i];
      view.setUint16(offset, eid.length, true);
      offset += 2;
      buf.set(eid, offset);
      offset += eid.length;

      let mask = 0;
      if (u.x !== undefined) mask |= 1;
      if (u.y !== undefined) mask |= 2;
      view.setUint8(offset, mask);
      offset += 1;

      if (u.x !== undefined) { view.setFloat32(offset, u.x, true); offset += 4; }
      if (u.y !== undefined) { view.setFloat32(offset, u.y, true); offset += 4; }
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

  if (type === MessageType.SnapshotAck) {
    return {
      type: MessageType.SnapshotAck,
      serverTick: view.getUint32(1, true)
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

  if (type === MessageType.EntityDelta) {
    const serverTick = view.getUint32(1, true);
    const baselineTick = view.getUint32(5, true);
    const count = view.getUint16(9, true);
    const updates: EntityDeltaState[] = [];
    let offset = 11;
    for (let i = 0; i < count; i++) {
      const idLen = view.getUint16(offset, true);
      offset += 2;
      const id = textDecoder.decode(buf.subarray(offset, offset + idLen));
      offset += idLen;
      
      const mask = view.getUint8(offset);
      offset += 1;
      
      const update: EntityDeltaState = { id };
      if ((mask & 1) !== 0) {
        update.x = view.getFloat32(offset, true);
        offset += 4;
      }
      if ((mask & 2) !== 0) {
        update.y = view.getFloat32(offset, true);
        offset += 4;
      }
      updates.push(update);
    }
    return {
      type: MessageType.EntityDelta,
      serverTick,
      baselineTick,
      updates
    };
  }

  throw new Error("Unknown message type: " + type);
}
