import { TransportProvider, TransportChannel } from "../transport/TransportContract.ts";
import { AnyMessage, MessageType, EntityState, Snapshot, EntityDeltaState } from "../protocol/messages.ts";
import { encodeMessage, decodeMessage } from "../protocol/binaryCodec.ts";

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

interface PlayerConnection {
  channel: TransportChannel;
  id: string;
  entityId: string;
  ackTick: number;
}

const connections = new Map<string, PlayerConnection>();
const entities = new Map<string, EntityState>();
const stateHistory = new Map<number, Map<string, EntityState>>();

let serverTick = 0;
const DISCONNECT_TIMEOUT_MS = 60000;

export function startRuntime(provider: TransportProvider) {
  provider.onConnection((channel) => {
    let connId: string | null = null;
    let authTimeout = setTimeout(() => channel.close(), 5000);

    channel.onMessage((data) => {
      try {
        const msg = decodeMessage(data) as AnyMessage;
        
        if (msg.type === MessageType.ClientHello) {
          if (connId) return; // Already authenticated
          clearTimeout(authTimeout);
          
          console.log(`[gameLoop] Received ClientHello. msg.clientId=`, msg.clientId);
          connId = msg.clientId;
          const entityId = `player_${connId}`;
          
          connections.set(connId, { channel, id: connId, entityId, ackTick: 0 });
          
          // Reconnect logic
          if (!entities.has(entityId)) {
            entities.set(entityId, { id: entityId, x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 });
          }

          channel.sendReliable(encodeMessage({
            type: MessageType.ServerHello,
            connectionId: connId
          }));
        } else if (connId) {
          handleMessage(connId, msg);
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    });

    channel.onClose(() => {
      if (connId) {
        connections.delete(connId);
        // Do not delete entity immediately to allow reconnection
        setTimeout(() => {
          if (!connections.has(connId!)) {
            entities.delete(`player_${connId}`);
          }
        }, DISCONNECT_TIMEOUT_MS);
      }
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

  if (msg.type === MessageType.SnapshotAck) { 
    if (msg.serverTick > conn.ackTick) {
      conn.ackTick = msg.serverTick;
    }
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
  
  const currentTickMap = new Map<string, EntityState>();
  for (const [k, v] of entities.entries()) {
    currentTickMap.set(k, { ...v });
  }
  stateHistory.set(serverTick, currentTickMap);

  if (stateHistory.size > 90) { // Keep last 3 seconds
    const minTick = Math.min(...stateHistory.keys());
    stateHistory.delete(minTick);
  }

  const allEntities = Array.from(entities.values());
  const INTEREST_RADIUS = 500;
  
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

    const baseline = stateHistory.get(conn.ackTick);

    if (baseline) {
      // Send delta
      const updates: EntityDeltaState[] = [];
      for (const e of relevantEntities) {
        const old = baseline.get(e.id);
        if (!old) {
          updates.push({ id: e.id, x: e.x, y: e.y });
        } else if (old.x !== e.x || old.y !== e.y) {
          const u: EntityDeltaState = { id: e.id };
          if (old.x !== e.x) u.x = e.x;
          if (old.y !== e.y) u.y = e.y;
          updates.push(u);
        }
      }

      // If no updates and we don't handle entity removal yet, we could skip sending.
      // But let's send anyway to acknowledge we're alive, or just rely on normal tick behavior.
      
      const payload = encodeMessage({
        type: MessageType.EntityDelta,
        serverTick,
        baselineTick: conn.ackTick,
        updates
      });
       conn.channel.sendUnreliable(payload);

    } else {
      // Send full snapshot
      const state: Snapshot = {
        type: MessageType.Snapshot,
        serverTick,
        entities: relevantEntities,
      };
      
      const payload = encodeMessage(state);
       conn.channel.sendUnreliable(payload);
    }
  }
}
