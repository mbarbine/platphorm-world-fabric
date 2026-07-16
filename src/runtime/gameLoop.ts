import { TransportProvider, TransportChannel } from "../transport/TransportContract.ts";
import { AnyMessage, MessageType, EntityState, Snapshot } from "../protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../protocol/binaryCodec.ts";

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

interface PlayerConnection {
  channel: TransportChannel;
  id: string;
  entityId: string;
}

const connections = new Map<string, PlayerConnection>();
const entities = new Map<string, EntityState>();
let serverTick = 0;

export function startRuntime(provider: TransportProvider) {
  provider.onConnection((channel) => {
    const connId = Math.random().toString(36).substring(7);
    const entityId = `player_${connId}`;
    
    connections.set(connId, { channel, id: connId, entityId });
    entities.set(entityId, { id: entityId, x: 0, y: 0 });
    
    channel.sendReliable(encodeMessage({
      type: MessageType.ServerHello,
      connectionId: connId
    }));

    channel.onMessage((data) => {
      try {
        const msg = decodeMessage(data) as AnyMessage;
        handleMessage(connId, msg);
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    });

    channel.onClose(() => {
      connections.delete(connId);
      entities.delete(entityId);
    });
  });

  // Deterministic fixed-step loop
  setInterval(() => {
    tick();
  }, TICK_MS);
}

function handleMessage(connId: string, msg: AnyMessage) {
  const conn = connections.get(connId);
  if (!conn) return;

  if (msg.type === MessageType.Ping) {
    conn.channel.sendUnreliable(encodeMessage({
      type: MessageType.Pong,
      clientTime: msg.clientTime,
      serverTime: Date.now()
    }));
  }

  if (msg.type === MessageType.InputFrame) {
    const entity = entities.get(conn.entityId);
    if (entity) {
      // Basic authoritative logic
      const speed = 5;
      entity.x += msg.inputX * speed;
      entity.y += msg.inputY * speed;
    }
  }
}

function tick() {
  serverTick++;
  
  const allEntities = Array.from(entities.values());
  const INTEREST_RADIUS = 1000;
  
  // Replicate to all clients with interest filtering
  for (const conn of connections.values()) {
    const playerEntity = entities.get(conn.entityId);
    let relevantEntities = allEntities;
    
    if (playerEntity) {
      relevantEntities = allEntities.filter(e => {
        const dx = e.x - playerEntity.x;
        const dy = e.y - playerEntity.y;
        const distSq = dx*dx + dy*dy;
        return distSq <= INTEREST_RADIUS * INTEREST_RADIUS;
      });
    }

    const state: Snapshot = {
      type: MessageType.Snapshot,
      serverTick,
      entities: relevantEntities,
    };
    
    const payload = encodeMessage(state);
    conn.channel.sendUnreliable(payload);
  }
}
