import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';
import { SmartClientTransport } from '../../src/transport/ClientTransport';
import { encodeMessage, decodeMessage } from '../../src/protocol/binaryCodec';
import { MessageType, AnyMessage, Snapshot } from '../../src/protocol/messages';

// Polyfill WebSocket for Node.js test environment
(global as any).WebSocket = WebSocket;

// Wrapper to simulate network impairment
class ImpairedTransport {
  public transport: SmartClientTransport;
  private lossRate: number;
  private maxJitterMs: number;

  constructor(host: string, lossRate: number = 0.2, maxJitterMs: number = 50) {
    this.transport = new SmartClientTransport(host);
    this.lossRate = lossRate;
    this.maxJitterMs = maxJitterMs;

    const originalSend = this.transport.send.bind(this.transport);
    this.transport.send = (data: string | Uint8Array) => {
      // Simulate packet loss
      if (Math.random() < this.lossRate) {
        return; // Drop packet
      }
      
      // Simulate jitter
      const delay = Math.random() * this.maxJitterMs;
      setTimeout(() => {
        try {
          originalSend(data);
        } catch (e) {
          // Ignore if closed
        }
      }, delay);
    };
  }

  send(data: string | Uint8Array) {
    this.transport.send(data);
  }

  onMessage(handler: (data: string | Uint8Array) => void) {
    this.transport.onMessage((data) => {
      if (Math.random() < this.lossRate) {
        return; // Drop packet
      }
      const delay = Math.random() * this.maxJitterMs;
      setTimeout(() => {
        handler(data);
      }, delay);
    });
  }

  start() {
    return this.transport.start();
  }

  close() {
    return this.transport.close();
  }
}

describe('SmartClientTransport Network Impairment', () => {
  it('should recover state gracefully under simulated packet loss and jitter', async () => {
    // 20% loss rate and 50ms jitter
    const impaired = new ImpairedTransport('ws://localhost:3000', 0.2, 50);
    
    let clientId: string | null = null;
    let snapshotsReceived = 0;

    impaired.onMessage((data) => {
      try {
        const msg = decodeMessage(data as Uint8Array) as AnyMessage;
        if (msg.type === MessageType.ServerHello) {
          clientId = msg.connectionId;
        } else if (msg.type === MessageType.Snapshot) {
          snapshotsReceived++;
        } else if (msg.type === MessageType.EntityDelta) {
          snapshotsReceived++;
        }
      } catch (e) {
        // Ignore decode errors
      }
    });

    await impaired.start();

    // Send ClientHello reliably for setup
    let retries = 0;
    while (!clientId && retries < 10) {
      impaired.transport.send(encodeMessage({ 
        type: MessageType.ClientHello, 
        clientId: "test_impaired_client", 
        version: "1.0.0" 
      }));
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    expect(clientId).toBeTruthy(); // Should have received ServerHello

    // Send multiple inputs using impaired transport
    for (let i = 1; i <= 15; i++) {
      impaired.send(encodeMessage({
        type: MessageType.InputFrame,
        sequence: i,
        inputX: 1,
        inputY: 0
      }));
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for state to sync
    await new Promise(resolve => setTimeout(resolve, 1500));

    expect(snapshotsReceived).toBeGreaterThan(0);
    
    impaired.close();
  }, 10000); // 10s timeout
});
