import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSocketClientTransport,
  WebRTCClientTransport,
  SmartClientTransport
} from '../../src/transport/ClientTransport';

class MockWebSocket {
  public static OPEN = 1;
  public static CLOSED = 3;
  public readyState = MockWebSocket.OPEN;
  public binaryType = 'blob';
  public url: string;

  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: any }) => void | Promise<void>) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;

  public sentMessages: any[] = [];
  public isClosed = false;

  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    if (url.includes('throw-ws-constructor')) {
      throw new Error('WebSocket constructor failed');
    }
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: any) {
    this.sentMessages.push(data);
  }

  close() {
    this.isClosed = true;
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  triggerOpen() {
    if (this.onopen) this.onopen();
  }

  async triggerMessage(data: any) {
    if (this.onmessage) {
      await this.onmessage({ data });
    }
  }

  triggerError(err: any) {
    if (this.onerror) this.onerror(err);
  }
}

class MockRTCDataChannel {
  public readyState = 'connecting';
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: any }) => void | Promise<void>) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;

  public sentData: any[] = [];
  public isClosed = false;

  constructor(public label: string) {}

  send(data: any) {
    this.sentData.push(data);
  }

  close() {
    this.isClosed = true;
    this.readyState = 'closed';
    if (this.onclose) this.onclose();
  }

  triggerOpen() {
    this.readyState = 'open';
    if (this.onopen) this.onopen();
  }

  async triggerMessage(data: any) {
    if (this.onmessage) {
      await this.onmessage({ data });
    }
  }

  triggerError(err: any) {
    if (this.onerror) this.onerror(err);
  }
}

class MockRTCPeerConnection {
  public dataChannel: MockRTCDataChannel | null = null;
  public onicecandidate: ((event: { candidate: any }) => void) | null = null;
  public localDescription: any = null;
  public remoteDescription: any = null;
  public candidates: any[] = [];
  public isClosed = false;

  static instances: MockRTCPeerConnection[] = [];

  constructor(public config: any) {
    if (config && config.iceServers && config.iceServers.includes('throw-pc-constructor')) {
      throw new Error('RTCPeerConnection constructor failed');
    }
    MockRTCPeerConnection.instances.push(this);
  }

  createDataChannel(label: string) {
    this.dataChannel = new MockRTCDataChannel(label);
    return this.dataChannel;
  }

  async createOffer() {
    if (this.dataChannel && this.dataChannel.label === 'throw-create-offer') {
      throw new Error('createOffer failed');
    }
    return { type: 'offer', sdp: 'mock-sdp' };
  }

  async setLocalDescription(offer: any) {
    this.localDescription = offer;
  }

  async setRemoteDescription(answer: any) {
    if (answer.sdp === 'invalid-sdp') {
      throw new Error('Invalid remote description');
    }
    this.remoteDescription = answer;
  }

  async addIceCandidate(candidate: any) {
    if (candidate === 'fail-candidate') {
      throw new Error('addIceCandidate failed');
    }
    this.candidates.push(candidate);
  }

  close() {
    this.isClosed = true;
  }
}

describe('ClientTransport Error Path & Lifecycle Unit Tests', () => {
  const originalWebSocket = global.WebSocket;
  const originalRTCPeerConnection = global.RTCPeerConnection;

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockRTCPeerConnection.instances = [];
    (global as any).WebSocket = MockWebSocket;
    (global as any).RTCPeerConnection = MockRTCPeerConnection;
  });

  afterEach(() => {
    (global as any).WebSocket = originalWebSocket;
    (global as any).RTCPeerConnection = originalRTCPeerConnection;
  });

  describe('WebSocketClientTransport', () => {
    it('should connect successfully and handle messages, send, and close', async () => {
      const transport = new WebSocketClientTransport('ws://localhost:3000/ws');
      expect(transport.getStatus()).toBe('Disconnected');

      const startPromise = transport.start();
      expect(transport.getStatus()).toBe('Connecting');

      const mockWs = MockWebSocket.instances[0];
      expect(mockWs).toBeDefined();

      mockWs.triggerOpen();
      await startPromise;

      expect(transport.getStatus()).toBe('WebSocket');

      let received: any = null;
      transport.onMessage((data) => { received = data; });
      await mockWs.triggerMessage('hello');
      expect(received).toBe('hello');

      transport.send('ping');
      expect(mockWs.sentMessages).toContain('ping');

      let closed = false;
      transport.onClose(() => { closed = true; });
      mockWs.close();
      expect(transport.getStatus()).toBe('Disconnected');
      expect(closed).toBe(true);
    });

    it('should reject and set status to Failed on connection error during Connecting', async () => {
      const transport = new WebSocketClientTransport('ws://localhost:3000/ws');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      const connError = new Error('Connection refused');
      mockWs.triggerError(connError);

      await expect(startPromise).rejects.toThrow('Connection refused');
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should catch and reject when WebSocket constructor throws', async () => {
      const transport = new WebSocketClientTransport('ws://throw-ws-constructor');
      const startPromise = transport.start();

      await expect(startPromise).rejects.toThrow('WebSocket constructor failed');
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should not throw on close when socket is null or already closed', () => {
      const transport = new WebSocketClientTransport('ws://localhost:3000/ws');
      expect(() => transport.close()).not.toThrow();
    });
  });

  describe('WebRTCClientTransport', () => {
    it('should successfully establish WebRTC connection via signaling', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      await new Promise(r => setTimeout(r, 10));

      const mockPc = MockRTCPeerConnection.instances[0];
      expect(mockPc).toBeDefined();
      expect(mockWs.sentMessages.length).toBeGreaterThan(0);

      // Simulate answer message from signaling
      await mockWs.triggerMessage(JSON.stringify({ type: 'answer', sdp: 'answer-sdp' }));

      expect(mockPc.remoteDescription).toEqual({ type: 'answer', sdp: 'answer-sdp' });

      // Trigger data channel open
      mockPc.dataChannel!.triggerOpen();
      await startPromise;

      expect(transport.getStatus()).toBe('WebRTC');

      // Test message sending and receiving
      let received: any = null;
      transport.onMessage((data) => { received = data; });
      await mockPc.dataChannel!.triggerMessage('game-data');
      expect(received).toBe('game-data');

      transport.send('client-input');
      expect(mockPc.dataChannel!.sentData).toContain('client-input');

      // Close transport
      transport.close();
      expect(mockPc.isClosed).toBe(true);
      expect(mockWs.isClosed).toBe(true);
    });

    it('should handle signaling WebSocket error during connection setup', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerError(new Error('Signaling error'));

      await expect(startPromise).rejects.toThrow('Signaling error');
      expect(transport.getStatus()).toBe('Failed');
      expect(mockWs.isClosed).toBe(true);
    });

    it('should catch error when RTCPeerConnection creation or createOffer fails', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      await new Promise(r => setTimeout(r, 10));

      await mockWs.triggerMessage('invalid json');
      await expect(startPromise).rejects.toThrow();
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should catch invalid JSON / error in signaling message during connection', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      // Trigger corrupt/invalid json on signaling
      await mockWs.triggerMessage('invalid-json{{{');

      await expect(startPromise).rejects.toThrow();
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should catch remote description error in answer message during connection', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      // Send answer with invalid SDP
      await mockWs.triggerMessage(JSON.stringify({ type: 'answer', sdp: 'invalid-sdp' }));

      await expect(startPromise).rejects.toThrow('Invalid remote description');
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should handle dataChannel error while in Connecting status', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      const mockPc = MockRTCPeerConnection.instances[0];
      mockPc.dataChannel!.triggerError(new Error('DataChannel error'));

      await expect(startPromise).rejects.toThrow('DataChannel error');
      expect(transport.getStatus()).toBe('Failed');
    });

    it('should send ICE candidates over signaling socket when generated', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      const mockPc = MockRTCPeerConnection.instances[0];
      expect(mockPc.onicecandidate).toBeDefined();

      mockPc.onicecandidate!({
        candidate: { toJSON: () => ({ candidate: 'candidate-1' }) }
      });

      const candidateMsg = mockWs.sentMessages.find(m => m.includes('candidate-1'));
      expect(candidateMsg).toBeDefined();
    });

    it('should queue pending ICE candidates until remote description is set', async () => {
      const transport = new WebRTCClientTransport('ws://localhost:3000/webrtc-signaling');
      const startPromise = transport.start();

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      const mockPc = MockRTCPeerConnection.instances[0];

      // Send candidate before answer
      await mockWs.triggerMessage(JSON.stringify({ type: 'candidate', candidate: 'cand-1' }));
      expect(mockPc.candidates).not.toContain('cand-1');

      // Send answer
      await mockWs.triggerMessage(JSON.stringify({ type: 'answer', sdp: 'answer-sdp' }));

      expect(mockPc.candidates).toContain('cand-1');

      // Send candidate after answer
      await mockWs.triggerMessage(JSON.stringify({ type: 'candidate', candidate: 'cand-2' }));
      expect(mockPc.candidates).toContain('cand-2');

      mockPc.dataChannel!.triggerOpen();
      await startPromise;
      expect(transport.getStatus()).toBe('WebRTC');
    });
  });

  describe('SmartClientTransport', () => {
    it('should connect via WebRTC when WebRTC succeeds', async () => {
      const smart = new SmartClientTransport('http://localhost:3000');
      const startPromise = smart.start();

      const signalingWs = MockWebSocket.instances[0];
      signalingWs.triggerOpen();
      await new Promise(r => setTimeout(r, 10));

      const mockPc = MockRTCPeerConnection.instances[0];
      await signalingWs.triggerMessage(JSON.stringify({ type: 'answer', sdp: 'answer-sdp' }));

      mockPc.dataChannel!.triggerOpen();
      await startPromise;

      expect(smart.getStatus()).toBe('WebRTC');
    });

    it('should fallback to WebSocket when WebRTC fails during start', async () => {
      const smart = new SmartClientTransport('http://localhost:3000');
      const startPromise = smart.start();

      const signalingWs = MockWebSocket.instances[0];
      signalingWs.triggerError(new Error('WebRTC signaling failed'));

      await new Promise(r => setTimeout(r, 10));

      const fallbackWs = MockWebSocket.instances[1];
      expect(fallbackWs).toBeDefined();

      fallbackWs.triggerOpen();
      await startPromise;

      expect(smart.getStatus()).toBe('WebSocket');
    });

    it('should propagate rejection when both WebRTC and WebSocket fallback fail', async () => {
      const smart = new SmartClientTransport('http://localhost:3000');
      const startPromise = smart.start();

      const signalingWs = MockWebSocket.instances[0];
      signalingWs.triggerError(new Error('WebRTC signaling failed'));

      await new Promise(r => setTimeout(r, 10));

      const fallbackWs = MockWebSocket.instances[1];
      fallbackWs.triggerError(new Error('WebSocket fallback failed'));

      await expect(startPromise).rejects.toThrow('WebSocket fallback failed');
      expect(smart.getStatus()).toBe('Disconnected');
    });
  });
});
