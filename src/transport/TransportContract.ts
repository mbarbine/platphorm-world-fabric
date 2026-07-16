export interface TransportChannel {
  id: string;
  onMessage(handler: (data: string | Buffer | Uint8Array) => void): void;
  onClose(handler: () => void): void;
  sendReliable(data: string | Buffer | Uint8Array): void;
  sendUnreliable(data: string | Buffer | Uint8Array): void;
  close(): void;
}

export interface TransportProvider {
  start(): void;
  onConnection(handler: (channel: TransportChannel) => void): void;
}
