import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage } from '../../src/protocol/binaryCodec';
import { MessageType, InputFrame, Ping, Pong, SnapshotAck, Snapshot, EntityDeltaMessage } from '../../src/protocol/messages';

describe('binaryCodec', () => {
  it('should encode and decode InputFrame', () => {
    const original: InputFrame = {
      type: MessageType.InputFrame,
      sequence: 42,
      inputX: -1.5,
      inputY: 2.25
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode Ping', () => {
    const original: Ping = {
      type: MessageType.Ping,
      clientTime: 12345.6789
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode Pong', () => {
    const original: Pong = {
      type: MessageType.Pong,
      clientTime: 12345.6789,
      serverTime: 98765.4321
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode SnapshotAck', () => {
    const original: SnapshotAck = {
      type: MessageType.SnapshotAck,
      serverTick: 1000
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode Snapshot', () => {
    const original: Snapshot = {
      type: MessageType.Snapshot,
      serverTick: 1001,
      entities: [
        { id: 'player-1', x: 10.5, y: 20.5 },
        { id: 'enemy-1', x: -50.125, y: 0 }
      ]
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode EntityDelta', () => {
    const original: EntityDeltaMessage = {
      type: MessageType.EntityDelta,
      serverTick: 1002,
      baselineTick: 1001,
      updates: [
        { id: 'player-1', x: 12.5 },
        { id: 'enemy-1', y: 5.5 },
        { id: 'item-1', x: 100, y: 200 }
      ]
    };
    const encoded = encodeMessage(original);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should fallback to JSON for unknown types', () => {
    const original = {
      type: 99 as MessageType, // unknown
      customData: 'hello world',
      flag: true
    };
    const encoded = encodeMessage(original as any);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });
});
