import { performance } from 'perf_hooks';
import { EntityState, EntityDeltaState } from '../../src/protocol/messages';

const entities = new Map<string, EntityState>();
const connections = new Map<string, any>();
const stateHistory = new Map<number, Map<string, EntityState>>();

const NUM_ENTITIES = 1000;
const NUM_CONNS = 50;
const INTEREST_RADIUS_SQ = 500 * 500;

for (let i = 0; i < NUM_ENTITIES; i++) {
  entities.set('e_' + i, { id: 'e_' + i, x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000 });
}

for (let i = 0; i < NUM_CONNS; i++) {
  connections.set('c_' + i, {
    id: 'c_' + i,
    entityId: 'e_' + i,
    ackTick: 10,
    channel: { sendUnreliable: () => {} }
  });
}

// 80% stationary entities reuse reference in baseline
const baselineMap = new Map<string, EntityState>();
for (const [id, e] of entities.entries()) {
  if (Math.random() < 0.8) {
    baselineMap.set(id, e);
  } else {
    baselineMap.set(id, { id, x: e.x + 1, y: e.y + 1 });
  }
}
stateHistory.set(10, baselineMap);

export function runUnoptimizedLoop(iterations = 1000) {
  const start = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    for (const conn of connections.values()) {
      const playerEntity = entities.get(conn.entityId);
      const px = playerEntity ? playerEntity.x : 0;
      const py = playerEntity ? playerEntity.y : 0;

      const baseline = stateHistory.get(conn.ackTick);

      if (baseline) {
        const updates: EntityDeltaState[] = [];
        for (const e of entities.values()) {
          if (playerEntity) {
            const dx = e.x - px;
            const dy = e.y - py;
            if (dx * dx + dy * dy > INTEREST_RADIUS_SQ) continue;
          }

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
      } else {
        const relevantEntities: EntityState[] = [];
        for (const e of entities.values()) {
          if (playerEntity) {
            const dx = e.x - px;
            const dy = e.y - py;
            if (dx * dx + dy * dy > INTEREST_RADIUS_SQ) continue;
          }
          relevantEntities.push(e);
        }
      }
    }
  }
  return performance.now() - start;
}

export function runOptimizedLoop(iterations = 1000) {
  const start = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    const entityList = Array.from(entities.values());
    const entityCount = entityList.length;

    for (const conn of connections.values()) {
      const playerEntity = entities.get(conn.entityId);
      const px = playerEntity ? playerEntity.x : 0;
      const py = playerEntity ? playerEntity.y : 0;

      const baseline = stateHistory.get(conn.ackTick);

      if (baseline) {
        const updates: EntityDeltaState[] = [];
        for (let i = 0; i < entityCount; i++) {
          const e = entityList[i];
          if (playerEntity) {
            const dx = e.x - px;
            const dy = e.y - py;
            if (dx * dx + dy * dy > INTEREST_RADIUS_SQ) continue;
          }

          const old = baseline.get(e.id);
          if (!old) {
            updates.push({ id: e.id, x: e.x, y: e.y });
          } else if (old === e) {
            continue;
          } else if (old.x !== e.x || old.y !== e.y) {
            const u: EntityDeltaState = { id: e.id };
            if (old.x !== e.x) u.x = e.x;
            if (old.y !== e.y) u.y = e.y;
            updates.push(u);
          }
        }
      } else {
        const relevantEntities: EntityState[] = [];
        for (let i = 0; i < entityCount; i++) {
          const e = entityList[i];
          if (playerEntity) {
            const dx = e.x - px;
            const dy = e.y - py;
            if (dx * dx + dy * dy > INTEREST_RADIUS_SQ) continue;
          }
          relevantEntities.push(e);
        }
      }
    }
  }
  return performance.now() - start;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Warmup
  for (let i = 0; i < 3; i++) {
    runUnoptimizedLoop(200);
    runOptimizedLoop(200);
  }

  let baseTotal = 0;
  let optTotal = 0;
  const RUNS = 10;
  for (let i = 0; i < RUNS; i++) {
    baseTotal += runUnoptimizedLoop(1000);
    optTotal += runOptimizedLoop(1000);
  }

  const avgBase = baseTotal / RUNS;
  const avgOpt = optTotal / RUNS;
  const speedup = ((avgBase - avgOpt) / avgBase) * 100;

  console.log(`Baseline (1000 ticks): ${avgBase.toFixed(2)} ms`);
  console.log(`Optimized (1000 ticks): ${avgOpt.toFixed(2)} ms`);
  console.log(`Improvement: ${speedup.toFixed(2)}%`);
}
