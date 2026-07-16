export interface TransportChannel {
  id: string;
  onMessage(handler: (data: string | Buffer) => void): void;
  onClose(handler: () => void): void;
  sendReliable(data: string | Buffer): void;
  sendUnreliable(data: string | Buffer): void;
  close(): void;
}

export interface TransportProvider {
  start(): void;
  onConnection(handler: (channel: TransportChannel) => void): void;
}
