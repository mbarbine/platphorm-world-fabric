import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage } from '../../src/protocol/binaryCodec';
import {
  MessageType,
  ClientHello,
  ServerHello,
  JoinSession,
  JoinAccepted,
  JoinRejected,
  InputFrame,
  Ping,
  Pong,
  SnapshotAck,
  Snapshot,
  EntityDeltaMessage
} from '../../src/protocol/messages';

describe('binaryCodec', () => {
  it('should encode and decode ClientHello', () => {
    const original: ClientHello = {
      type: MessageType.ClientHello,
      clientId: 'client_abc123',
      version: '1.2.3'
    };
    const encoded = encodeMessage(original);
    expect(encoded[0]).toBe(MessageType.ClientHello);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode ServerHello', () => {
    const original: ServerHello = {
      type: MessageType.ServerHello,
      connectionId: 'conn_xyz789'
    };
    const encoded = encodeMessage(original);
    expect(encoded[0]).toBe(MessageType.ServerHello);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode JoinSession', () => {
    const original: JoinSession = {
      type: MessageType.JoinSession,
      sessionId: 'sess_100',
      token: 'tok_secret_key'
    };
    const encoded = encodeMessage(original);
    expect(encoded[0]).toBe(MessageType.JoinSession);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode JoinAccepted', () => {
    const original: JoinAccepted = {
      type: MessageType.JoinAccepted,
      sessionId: 'sess_100'
    };
    const encoded = encodeMessage(original);
    expect(encoded[0]).toBe(MessageType.JoinAccepted);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

  it('should encode and decode JoinRejected', () => {
    const original: JoinRejected = {
      type: MessageType.JoinRejected,
      reason: 'Lobby full'
    };
    const encoded = encodeMessage(original);
    expect(encoded[0]).toBe(MessageType.JoinRejected);
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });

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

  it('should correctly encode and decode non-ASCII UTF-8 entity IDs in Snapshot and EntityDelta', () => {
    const nonAsciiSnapshot: Snapshot = {
      type: MessageType.Snapshot,
      serverTick: 2001,
      entities: [
        { id: 'player_⚡_1', x: 15.0, y: 30.0 },
        { id: 'boss_👾', x: -100.5, y: 250.0 }
      ]
    };
    const encodedSnapshot = encodeMessage(nonAsciiSnapshot);
    const decodedSnapshot = decodeMessage(encodedSnapshot);
    expect(decodedSnapshot).toEqual(nonAsciiSnapshot);

    const nonAsciiDelta: EntityDeltaMessage = {
      type: MessageType.EntityDelta,
      serverTick: 2002,
      baselineTick: 2001,
      updates: [
        { id: 'player_⚡_1', x: 18.5 },
        { id: 'boss_👾', y: 260.0 }
      ]
    };
    const encodedDelta = encodeMessage(nonAsciiDelta);
    const decodedDelta = decodeMessage(encodedDelta);
    expect(decodedDelta).toEqual(nonAsciiDelta);
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
    expect(encoded[0]).toBe(0xFF); // Check fallback tag
    const decoded = decodeMessage(encoded);
    expect(decoded).toEqual(original);
  });
});
