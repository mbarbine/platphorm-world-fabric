import { WebSocketServer, WebSocket } from "ws";
import { TransportChannel, TransportProvider } from "./TransportContract.ts";

class WebSocketChannel implements TransportChannel {
  public id: string;
  private messageHandlers: ((data: string | Buffer | Uint8Array) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(private ws: WebSocket) {
    this.id = Math.random().toString(36).substring(7);
    this.ws.on('message', (data) => {
      // Bolt Optimization: Indexed loop with dynamic .length avoids iterator object allocation per incoming frame
      for (let i = 0; i < this.messageHandlers.length; i++) {
        this.messageHandlers[i](data as Buffer);
      }
    });
    this.ws.on('close', () => {
      for (let i = 0; i < this.closeHandlers.length; i++) {
        this.closeHandlers[i]();
      }
    });
  }

  onMessage(handler: (data: string | Buffer | Uint8Array) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  sendReliable(data: string | Buffer | Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendUnreliable(data: string | Buffer | Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(): void {
    this.ws.close();
  }
}

export class WebSocketTransportProvider implements TransportProvider {
  private connectionHandlers: ((channel: TransportChannel) => void)[] = [];

  constructor(private wss: WebSocketServer) {
    this.wss.on('connection', (ws) => {
      const channel = new WebSocketChannel(ws);
      for (let i = 0; i < this.connectionHandlers.length; i++) {
        this.connectionHandlers[i](channel);
      }
    });
  }

  start(): void {}

  onConnection(handler: (channel: TransportChannel) => void): void {
    this.connectionHandlers.push(handler);
  }
}
