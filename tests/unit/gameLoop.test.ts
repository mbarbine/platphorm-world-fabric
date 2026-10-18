import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startRuntime } from '../../src/runtime/gameLoop';
import { TransportProvider, TransportChannel } from '../../src/transport/TransportContract';
import { encodeMessage, decodeMessage } from '../../src/protocol/binaryCodec';
import { MessageType } from '../../src/protocol/messages';

class MockChannel implements TransportChannel {
  id = 'mock-channel-1';
  messageHandler: ((data: string | Buffer | Uint8Array) => void) | null = null;
  closeHandler: (() => void) | null = null;
  sentReliable: (string | Buffer | Uint8Array)[] = [];
  sentUnreliable: (string | Buffer | Uint8Array)[] = [];
  closed = false;

  onMessage(handler: (data: string | Buffer | Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  sendReliable(data: string | Buffer | Uint8Array): void {
    this.sentReliable.push(data);
  }

  sendUnreliable(data: string | Buffer | Uint8Array): void {
    this.sentUnreliable.push(data);
  }

  close(): void {
    this.closed = true;
    if (this.closeHandler) {
      this.closeHandler();
    }
  }

  emitMessage(data: string | Buffer | Uint8Array) {
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  emitClose() {
    if (this.closeHandler) {
      this.closeHandler();
    }
  }
}

class MockProvider implements TransportProvider {
  connectionHandler: ((channel: TransportChannel) => void) | null = null;

  start(): void {}

  onConnection(handler: (channel: TransportChannel) => void): void {
    this.connectionHandler = handler;
  }

  connectClient(channel: TransportChannel): void {
    if (this.connectionHandler) {
      this.connectionHandler(channel);
    }
  }
}

describe('gameLoop decode message error handling', () => {
  let provider: MockProvider;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new MockProvider();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle invalid JSON fallback payload error gracefully without crashing', () => {
    startRuntime(provider);
    const channel = new MockChannel();
    provider.connectClient(channel);

    // 0xFF prefix indicates JSON fallback, followed by malformed JSON payload "{"
    const badJsonData = new Uint8Array([0xFF, 0x7B]);
    channel.emitMessage(badJsonData);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse message', expect.any(Error));
    expect(channel.closed).toBe(false);
  });

  it('should handle unknown binary message type error gracefully', () => {
    startRuntime(provider);
    const channel = new MockChannel();
    provider.connectClient(channel);

    // 0x99 is an unknown message type byte
    const unknownTypeData = new Uint8Array([0x99, 0x01, 0x02]);
    channel.emitMessage(unknownTypeData);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse message',
      expect.objectContaining({
        message: expect.stringContaining('Unknown message type: 153')
      })
    );
    expect(channel.closed).toBe(false);
  });

  it('should recover after decode error and process subsequent valid messages', () => {
    startRuntime(provider);
    const channel = new MockChannel();
    provider.connectClient(channel);

    // Emit bad bytes
    const badData = new Uint8Array([0xFF, 0x00]);
    channel.emitMessage(badData);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    // Emit valid ClientHello
    const helloMsg = encodeMessage({
      type: MessageType.ClientHello,
      clientId: 'client_err_recovery_' + Date.now(),
      version: '1.0.0'
    });
    channel.emitMessage(helloMsg);

    expect(channel.sentReliable.length).toBe(1);
    const decodedReply = decodeMessage(channel.sentReliable[0]);
    expect(decodedReply.type).toBe(MessageType.ServerHello);
  });

  it('should handle malformed message after client authentication and continue processing', () => {
    startRuntime(provider);
    const channel = new MockChannel();
    provider.connectClient(channel);

    const clientId = 'client_auth_err_' + Date.now();
    const helloMsg = encodeMessage({
      type: MessageType.ClientHello,
      clientId,
      version: '1.0.0'
    });
    channel.emitMessage(helloMsg);
    expect(channel.sentReliable.length).toBe(1);

    // Send bad bytes after authentication
    const corruptedPayload = new Uint8Array([0x99, 0xFF, 0xFE]);
    channel.emitMessage(corruptedPayload);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse message', expect.any(Error));

    // Send valid Ping afterwards
    const pingMsg = encodeMessage({
      type: MessageType.Ping,
      clientTime: 123456
    });
    channel.emitMessage(pingMsg);

    expect(channel.sentUnreliable.length).toBeGreaterThan(0);
    const reply = decodeMessage(channel.sentUnreliable[0]);
    expect(reply.type).toBe(MessageType.Pong);
  });
});
