export interface ClientTransport {
  start(): Promise<void>;
  send(data: string | Uint8Array): void;
  onMessage(handler: (data: string | Uint8Array) => void): void;
  onClose(handler: () => void): void;
  close(): void;
  getStatus(): 'Connecting' | 'WebRTC' | 'WebSocket' | 'Disconnected' | 'Failed';
}

export class WebSocketClientTransport implements ClientTransport {
  private ws: WebSocket | null = null;
  private messageHandlers: ((data: string | Uint8Array) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private status: 'Connecting' | 'WebSocket' | 'Disconnected' | 'Failed' = 'Disconnected';

  constructor(private url: string) {}

  async start(): Promise<void> {
    this.status = 'Connecting';
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        this.status = 'WebSocket';
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        // Bolt Optimization: Standard indexed loop avoids iterator object allocation per incoming message
        for (let i = 0; i < this.messageHandlers.length; i++) {
          this.messageHandlers[i](event.data);
        }
      };

      this.ws.onclose = () => {
        this.status = 'Disconnected';
        for (let i = 0; i < this.closeHandlers.length; i++) {
          this.closeHandlers[i]();
        }
      };
      
      this.ws.onerror = (err) => {
        if (this.status === 'Connecting') {
          this.status = 'Failed';
          reject(err);
        }
      };
    });
  }

  send(data: string | Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  onMessage(handler: (data: string | Uint8Array) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    if (this.ws) this.ws.close();
  }

  getStatus(): "Connecting" | "WebRTC" | "WebSocket" | "Disconnected" | "Failed" {
    return this.status;
  }
}

export class WebRTCClientTransport implements ClientTransport {
  private peerConn: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingWs: WebSocket | null = null;
  
  private messageHandlers: ((data: string | Uint8Array) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private status: 'Connecting' | 'WebRTC' | 'Disconnected' | 'Failed' = 'Disconnected';

  constructor(private signalingUrl: string) {}

  async start(): Promise<void> {
    this.status = 'Connecting';
    return new Promise((resolve, reject) => {
      this.signalingWs = new WebSocket(this.signalingUrl);
      
      const fail = (err: any) => {
        this.status = 'Failed';
        if (this.signalingWs) this.signalingWs.close();
        if (this.peerConn) this.peerConn.close();
        reject(err);
      };

      this.signalingWs.onerror = fail;
      
      this.signalingWs.onopen = async () => {
        try {
          this.peerConn = new RTCPeerConnection({
            iceServers: [] // Rely on host candidates for local dev / testing
          });
          
          this.dataChannel = this.peerConn.createDataChannel("game");
          this.dataChannel.onopen = () => {
            this.status = 'WebRTC';
            resolve();
          };
          this.dataChannel.onmessage = (event) => {
            // Bolt Optimization: Standard indexed loop avoids iterator object allocation per incoming message
            for (let i = 0; i < this.messageHandlers.length; i++) {
              this.messageHandlers[i](event.data);
            }
          };
          this.dataChannel.onclose = () => {
            this.status = 'Disconnected';
            for (let i = 0; i < this.closeHandlers.length; i++) {
              this.closeHandlers[i]();
            }
          };
          
          this.peerConn.onicecandidate = (event) => {
            if (event.candidate && this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
              this.signalingWs.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate.toJSON()
              }));
            }
          };
          
          let hasRemoteDescription = false;
          const pendingCandidates: any[] = [];
          this.signalingWs!.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'answer' && this.peerConn) {
              await this.peerConn.setRemoteDescription(msg);
              hasRemoteDescription = true;
              for (const candidate of pendingCandidates) {
                await this.peerConn.addIceCandidate(candidate).catch(e => console.warn("Ice candidate error:", e));
              }
              pendingCandidates.length = 0;
            } else if (msg.type === 'candidate' && this.peerConn) {
              if (hasRemoteDescription) {
                await this.peerConn.addIceCandidate(msg.candidate).catch(e => console.warn("Ice candidate error:", e));
              } else {
                pendingCandidates.push(msg.candidate);
              }
            }
          };

          const offer = await this.peerConn.createOffer();
          await this.peerConn.setLocalDescription(offer);
          
          this.signalingWs!.send(JSON.stringify(offer));
        } catch (e) {
          fail(e);
        }
      };
    });
  }

  send(data: string | Uint8Array): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      if (typeof data === 'string') {
        this.dataChannel.send(data);
      } else {
        this.dataChannel.send(data);
      }
    }
  }

  onMessage(handler: (data: string | Uint8Array) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConn) this.peerConn.close();
    if (this.signalingWs) this.signalingWs.close();
  }

  getStatus(): "Connecting" | "WebRTC" | "WebSocket" | "Disconnected" | "Failed" {
    return this.status;
  }
}

export class SmartClientTransport implements ClientTransport {
  private activeTransport: ClientTransport | null = null;
  private messageHandlers: ((data: string | Uint8Array) => void)[] = [];
  private closeHandlers: (() => void)[] = [];

  constructor(private host: string) {}

  async start(): Promise<void> {
    const wsUrl = this.host.replace(/^http/, 'ws');
    const rtc = new WebRTCClientTransport(`${wsUrl}/webrtc-signaling`);
    try {
      // Try WebRTC first
      await Promise.race([
        rtc.start(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("WebRTC timeout")), 5000))
      ]);
      this.activeTransport = rtc;
      console.log("Connected via WebRTC Data Channel");
    } catch (e) {
      console.warn("WebRTC failed, falling back to WebSocket", e);
      rtc.close();
      const ws = new WebSocketClientTransport(`${wsUrl}/ws`);
      await ws.start();
      this.activeTransport = ws;
      console.log("Connected via WebSocket Fallback");
    }

    this.activeTransport.onMessage(data => {
      // Bolt Optimization: Standard indexed loop avoids iterator object allocation per incoming message
      for (let i = 0; i < this.messageHandlers.length; i++) {
        this.messageHandlers[i](data);
      }
    });
    this.activeTransport.onClose(() => {
      for (let i = 0; i < this.closeHandlers.length; i++) {
        this.closeHandlers[i]();
      }
    });
  }

  send(data: string | Uint8Array): void {
    if (this.activeTransport) this.activeTransport.send(data);
  }

  onMessage(handler: (data: string | Uint8Array) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  close(): void {
    if (this.activeTransport) this.activeTransport.close();
  }

  getStatus(): "Connecting" | "WebRTC" | "WebSocket" | "Disconnected" | "Failed" {
    if (!this.activeTransport) return "Disconnected";
    return this.activeTransport.getStatus();
  }
}
