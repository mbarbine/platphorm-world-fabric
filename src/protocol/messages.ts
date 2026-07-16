export enum MessageType {
  ClientHello = 1,
  ServerHello = 2,
  JoinSession = 3,
  JoinAccepted = 4,
  JoinRejected = 5,
  InputFrame = 6,
  Snapshot = 7,
  EntityDelta = 8,
  Ping = 9,
  Pong = 10,
  SnapshotAck = 11,
}

export interface ClientHello {
  type: MessageType.ClientHello;
  clientId: string;
  version: string;
}

export interface ServerHello {
  type: MessageType.ServerHello;
  connectionId: string;
}

export interface InputFrame {
  type: MessageType.InputFrame;
  sequence: number;
  inputX: number;
  inputY: number;
}

export interface EntityState {
  id: string;
  x: number;
  y: number;
}

export interface Snapshot {
  type: MessageType.Snapshot;
  serverTick: number;
  entities: EntityState[];
}

export interface EntityDeltaState {
  id: string;
  x?: number;
  y?: number;
}

export interface EntityDeltaMessage {
  type: MessageType.EntityDelta;
  serverTick: number;
  baselineTick: number;
  updates: EntityDeltaState[];
}

export interface SnapshotAck {
  type: MessageType.SnapshotAck;
  serverTick: number;
}

export interface Ping {
  type: MessageType.Ping;
  clientTime: number;
}

export interface Pong {
  type: MessageType.Pong;
  clientTime: number;
  serverTime: number;
}

export type AnyMessage = 
  | ClientHello 
  | ServerHello 
  | InputFrame 
  | Snapshot
  | EntityDeltaMessage
  | SnapshotAck
  | Ping
  | Pong;

