import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SmartClientTransport,
  WebRTCClientTransport,
  WebSocketClientTransport
} from '../../src/transport/ClientTransport';

describe('SmartClientTransport Fallback & Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fall back to WebSocket when WebRTC fails to start', async () => {
    const rtcStartSpy = vi
      .spyOn(WebRTCClientTransport.prototype, 'start')
      .mockRejectedValue(new Error('WebRTC signaling failed'));
    const rtcCloseSpy = vi
      .spyOn(WebRTCClientTransport.prototype, 'close')
      .mockImplementation(() => {});

    const wsStartSpy = vi
      .spyOn(WebSocketClientTransport.prototype, 'start')
      .mockResolvedValue(undefined);
    vi.spyOn(WebSocketClientTransport.prototype, 'getStatus').mockReturnValue('WebSocket');

    const transport = new SmartClientTransport('http://localhost:3000');
    expect(transport.getStatus()).toBe('Disconnected');

    await transport.start();

    expect(rtcStartSpy).toHaveBeenCalledTimes(1);
    expect(rtcCloseSpy).toHaveBeenCalledTimes(1);
    expect(wsStartSpy).toHaveBeenCalledTimes(1);
    expect(transport.getStatus()).toBe('WebSocket');
  });

  it('should fall back to WebSocket when WebRTC times out after 5000ms', async () => {
    vi.useFakeTimers();

    // WebRTC start hangs indefinitely
    const rtcStartSpy = vi
      .spyOn(WebRTCClientTransport.prototype, 'start')
      .mockImplementation(() => new Promise(() => {}));
    const rtcCloseSpy = vi
      .spyOn(WebRTCClientTransport.prototype, 'close')
      .mockImplementation(() => {});

    const wsStartSpy = vi
      .spyOn(WebSocketClientTransport.prototype, 'start')
      .mockResolvedValue(undefined);
    vi.spyOn(WebSocketClientTransport.prototype, 'getStatus').mockReturnValue('WebSocket');

    const transport = new SmartClientTransport('http://localhost:3000');

    const startPromise = transport.start();

    // Advance past the 5000ms timeout
    await vi.advanceTimersByTimeAsync(5000);
    await startPromise;

    expect(rtcStartSpy).toHaveBeenCalledTimes(1);
    expect(rtcCloseSpy).toHaveBeenCalledTimes(1);
    expect(wsStartSpy).toHaveBeenCalledTimes(1);
    expect(transport.getStatus()).toBe('WebSocket');
  });

  it('should connect via WebRTC when WebRTC succeeds', async () => {
    const rtcStartSpy = vi
      .spyOn(WebRTCClientTransport.prototype, 'start')
      .mockResolvedValue(undefined);
    vi.spyOn(WebRTCClientTransport.prototype, 'getStatus').mockReturnValue('WebRTC');

    const wsStartSpy = vi
      .spyOn(WebSocketClientTransport.prototype, 'start')
      .mockResolvedValue(undefined);

    const transport = new SmartClientTransport('http://localhost:3000');
    await transport.start();

    expect(rtcStartSpy).toHaveBeenCalledTimes(1);
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(transport.getStatus()).toBe('WebRTC');
  });

  it('should reject when both WebRTC and WebSocket fail to connect', async () => {
    vi.spyOn(WebRTCClientTransport.prototype, 'start').mockRejectedValue(
      new Error('WebRTC failed')
    );
    vi.spyOn(WebRTCClientTransport.prototype, 'close').mockImplementation(() => {});

    vi.spyOn(WebSocketClientTransport.prototype, 'start').mockRejectedValue(
      new Error('WebSocket connection refused')
    );

    const transport = new SmartClientTransport('http://localhost:3000');

    await expect(transport.start()).rejects.toThrow('WebSocket connection refused');
    expect(transport.getStatus()).toBe('Disconnected');
  });

  it('should delegate send, close, message, and close handlers to fallback transport', async () => {
    let wsMessageHandler: ((data: string | Uint8Array) => void) | null = null;
    let wsCloseHandler: (() => void) | null = null;

    vi.spyOn(WebRTCClientTransport.prototype, 'start').mockRejectedValue(
      new Error('WebRTC error')
    );
    vi.spyOn(WebRTCClientTransport.prototype, 'close').mockImplementation(() => {});

    vi.spyOn(WebSocketClientTransport.prototype, 'start').mockResolvedValue(undefined);
    const wsSendSpy = vi
      .spyOn(WebSocketClientTransport.prototype, 'send')
      .mockImplementation(() => {});
    const wsCloseSpy = vi
      .spyOn(WebSocketClientTransport.prototype, 'close')
      .mockImplementation(() => {});

    vi.spyOn(WebSocketClientTransport.prototype, 'onMessage').mockImplementation((handler) => {
      wsMessageHandler = handler;
    });
    vi.spyOn(WebSocketClientTransport.prototype, 'onClose').mockImplementation((handler) => {
      wsCloseHandler = handler;
    });

    const transport = new SmartClientTransport('http://localhost:3000');

    const receivedMessages: (string | Uint8Array)[] = [];
    let closeCalled = false;

    transport.onMessage((data) => receivedMessages.push(data));
    transport.onClose(() => {
      closeCalled = true;
    });

    await transport.start();

    // Verify sending data forwards to fallback transport
    transport.send('test payload');
    expect(wsSendSpy).toHaveBeenCalledWith('test payload');

    // Verify incoming message on fallback transport forwards to SmartClientTransport handlers
    expect(wsMessageHandler).not.toBeNull();
    wsMessageHandler!('fallback message');
    expect(receivedMessages).toEqual(['fallback message']);

    // Verify close event on fallback transport forwards to SmartClientTransport handlers
    expect(wsCloseHandler).not.toBeNull();
    wsCloseHandler!();
    expect(closeCalled).toBe(true);

    // Verify close() on SmartClientTransport calls close on active transport
    transport.close();
    expect(wsCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('should construct correct WebSocket URLs for HTTP and HTTPS hosts', async () => {
    let capturedSignalingUrl = '';
    let capturedWsUrl = '';

    vi.spyOn(WebRTCClientTransport.prototype, 'start').mockImplementation(function (
      this: any
    ) {
      capturedSignalingUrl = this.signalingUrl;
      return Promise.reject(new Error('RTC failed'));
    });
    vi.spyOn(WebRTCClientTransport.prototype, 'close').mockImplementation(() => {});

    vi.spyOn(WebSocketClientTransport.prototype, 'start').mockImplementation(function (
      this: any
    ) {
      capturedWsUrl = this.url;
      return Promise.resolve();
    });
    vi.spyOn(WebSocketClientTransport.prototype, 'getStatus').mockReturnValue('WebSocket');

    // 1. Test http host
    const httpTransport = new SmartClientTransport('http://mygame.com:8080');
    await httpTransport.start();

    expect(capturedSignalingUrl).toBe('ws://mygame.com:8080/webrtc-signaling');
    expect(capturedWsUrl).toBe('ws://mygame.com:8080/ws');
    expect(httpTransport.getStatus()).toBe('WebSocket');

    // 2. Test https host
    const httpsTransport = new SmartClientTransport('https://secure.mygame.com');
    await httpsTransport.start();

    expect(capturedSignalingUrl).toBe('wss://secure.mygame.com/webrtc-signaling');
    expect(capturedWsUrl).toBe('wss://secure.mygame.com/ws');
    expect(httpsTransport.getStatus()).toBe('WebSocket');
  });
});
