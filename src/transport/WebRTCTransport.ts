import { WebSocketServer } from "ws";
import { TransportChannel, TransportProvider } from "./TransportContract.ts";

// Dummy WebRTC provider that just passes signaling through to simulate a provider
export class WebRTCTransportProvider implements TransportProvider {
  private connectionHandlers: ((channel: TransportChannel) => void)[] = [];

  constructor(private signalingServer: WebSocketServer) {
    this.signalingServer.on('connection', (ws) => {
      // In a real Node WebRTC impl (like wrtc), we would negotiate WebRTC here.
      // Currently, it's just a placeholder since we primarily use WebSocket in Node.js
    });
  }

  start(): void {}

  onConnection(handler: (channel: TransportChannel) => void): void {
    this.connectionHandlers.push(handler);
  }
}
