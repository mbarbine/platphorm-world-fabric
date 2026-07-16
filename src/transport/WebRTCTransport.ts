import { WebSocketServer } from "ws";
import { TransportChannel, TransportProvider } from "./TransportContract.ts";
import { RTCPeerConnection } from "werift";

class WebRTCChannel implements TransportChannel {
  public id: string;
  private messageHandlers: ((data: string | Buffer | Uint8Array) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(private dc: any) {
    this.id = Math.random().toString(36).substring(7);
    this.dc.onMessage.subscribe((data: string | Buffer | Uint8Array) => {
      for (const h of this.messageHandlers) h(data);
    });
    this.dc.onClose.subscribe(() => {
      for (const h of this.closeHandlers) h();
    });
  }

  onMessage(handler: (data: string | Buffer | Uint8Array) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  sendReliable(data: string | Buffer | Uint8Array): void {
    if (this.dc.readyState === "open") {
      this.dc.send(data);
    }
  }

  sendUnreliable(data: string | Buffer | Uint8Array): void {
    if (this.dc.readyState === "open") {
      this.dc.send(data);
    }
  }

  close(): void {
    this.dc.close();
  }
}

export class WebRTCTransportProvider implements TransportProvider {
  private connectionHandlers: ((channel: TransportChannel) => void)[] = [];

  constructor(private signalingServer: WebSocketServer) {
    this.signalingServer.on('connection', (ws) => {
      let pc: RTCPeerConnection | null = null;
      let hasRemoteDescription = false;
      const pendingCandidates: any[] = [];

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'offer') {
            pc = new RTCPeerConnection();
            
            pc.onDataChannel.subscribe((dc) => {
              const channel = new WebRTCChannel(dc);
              for (const h of this.connectionHandlers) h(channel);
            });

            pc.onIceCandidate.subscribe((candidate) => {
              if (candidate && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'candidate', candidate }));
              }
            });

            await pc.setRemoteDescription(msg);
            hasRemoteDescription = true;
            for (const candidate of pendingCandidates) {
              await pc.addIceCandidate(candidate).catch(e => console.warn("Ice candidate error:", e));
            }
            pendingCandidates.length = 0;

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(pc.localDescription));
            }
          } else if (msg.type === 'candidate' && pc) {
            if (hasRemoteDescription) {
              await pc.addIceCandidate(msg.candidate).catch(e => console.warn("Ice candidate error:", e));
            } else {
              pendingCandidates.push(msg.candidate);
            }
          }
        } catch (e) {
          console.error("WebRTC Signaling Error:", e);
        }
      });

      ws.on('close', () => {
        if (pc) {
          pc.close();
        }
      });
    });
  }

  start(): void {}

  onConnection(handler: (channel: TransportChannel) => void): void {
    this.connectionHandlers.push(handler);
  }
}
