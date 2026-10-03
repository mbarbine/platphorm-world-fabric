import { getLobby, Lobby } from './lobby.js';

interface Ticket {
  id: string;
  lobbyId: string;
  status: 'queued' | 'allocated' | 'failed';
  assignedSessionId?: string;
  workerUrl?: string;
  createdAt: number;
  allocatedAt?: number;
}

const tickets = new Map<string, Ticket>();

// Bolt Optimization: Maintain running metric counters and a fixed-size sliding window for wait times.
// This turns getMatchmakingMetrics from an O(N log N) linear Map scan and sort over all historical tickets
// into an O(1) counter lookup and bounded O(K log K) sort (K <= 100), eliminating GC pressure during telemetry polling.
let queuedCount = 0;
let allocatedCount = 0;
let failedCount = 0;
const MAX_WAIT_TIME_SAMPLES = 100;
const recentWaitTimes: number[] = [];

export function submitTicket(lobbyId: string): string {
  const ticketId = Math.random().toString(36).substring(7);
  tickets.set(ticketId, {
    id: ticketId,
    lobbyId,
    status: 'queued',
    createdAt: Date.now(),
  });
  queuedCount++;
  
  // Simulated matchmaker logic: instantly allocate after 2-5 seconds
  setTimeout(() => {
    allocateTicket(ticketId);
  }, 2000 + Math.random() * 3000);

  return ticketId;
}

function allocateTicket(ticketId: string) {
  const ticket = tickets.get(ticketId);
  if (!ticket) return;
  if (ticket.status === 'queued') {
    queuedCount--;
  }
  ticket.status = 'allocated';
  ticket.allocatedAt = Date.now();
  ticket.assignedSessionId = "session_" + Math.random().toString(36).substring(7);
  // Do not hardcode localhost. An empty workerUrl will tell the client to use its current host.
  ticket.workerUrl = "";

  allocatedCount++;
  const waitMs = ticket.allocatedAt - ticket.createdAt;
  recentWaitTimes.push(waitMs);
  if (recentWaitTimes.length > MAX_WAIT_TIME_SAMPLES) {
    recentWaitTimes.shift();
  }
}

export function getTicket(ticketId: string): Ticket | null {
  return tickets.get(ticketId) || null;
}

export function getMatchmakingMetrics() {
  const totalTracked = queuedCount + allocatedCount + failedCount;

  // Generate some synthetic historical metrics to make the chart look alive if empty
  if (totalTracked === 0 && tickets.size === 0) {
    const syntheticQueueDepth = Math.floor(Math.random() * 50);
    const syntheticP95 = 2000 + Math.random() * 3000;
    return {
      queueDepth: syntheticQueueDepth,
      p95WaitTimeMs: syntheticP95,
      status: {
        queued: syntheticQueueDepth,
        allocated: 120 + Math.floor(Math.random() * 50),
        failed: Math.floor(Math.random() * 5)
      }
    };
  }

  // Bolt Optimization: Compute P95 over bounded recent wait times (max 100 samples)
  let p95WaitTimeMs = 0;
  if (recentWaitTimes.length > 0) {
    const sorted = [...recentWaitTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    p95WaitTimeMs = sorted[p95Index] || 0;
  }

  return {
    queueDepth: queuedCount,
    p95WaitTimeMs,
    status: {
      queued: queuedCount,
      allocated: allocatedCount,
      failed: failedCount,
    }
  };
}
