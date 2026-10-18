import { getLobby, Lobby } from './lobby.js';
import { SessionAllocator } from '../allocator/SessionAllocator.js';

export const sessionAllocator = new SessionAllocator();
sessionAllocator.registerNode("node-us-east-1", "us-east-1", 1000);
sessionAllocator.registerNode("node-us-west-2", "us-west-2", 1000);
sessionAllocator.registerNode("node-eu-central-1", "eu-central-1", 1000);
sessionAllocator.registerNode("node-ap-northeast-1", "ap-northeast-1", 1000);
sessionAllocator.registerNode("node-us-east", "us-east", 1000);

interface Ticket {
  id: string;
  lobbyId: string;
  region?: string;
  status: 'queued' | 'allocated' | 'failed';
  assignedSessionId?: string;
  workerUrl?: string;
  createdAt: number;
  allocatedAt?: number;
}

const tickets = new Map<string, Ticket>();

// Bolt Optimization: Maintain incremental counters and a bounded rolling buffer for P95 latency calculations.
// Scanning and sorting all historical tickets on every 1s HTTP metrics poll degrades performance from O(1) to O(N log N) over time.
let queuedCount = 0;
let allocatedCount = 0;
let failedCount = 0;
const MAX_WAIT_TIME_SAMPLES = 200;
const recentWaitTimes: number[] = [];

export function submitTicket(lobbyId: string, region: string = "us-east"): string {
  const ticketId = Math.random().toString(36).substring(7);
  tickets.set(ticketId, {
    id: ticketId,
    lobbyId,
    region,
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
    queuedCount = Math.max(0, queuedCount - 1);
  }
  ticket.status = 'allocated';
  ticket.allocatedAt = Date.now();
  const session = sessionAllocator.requestSession(ticket.region || "us-east");
  ticket.assignedSessionId = session.id;
  // Do not hardcode localhost. An empty workerUrl will tell the client to use its current host.
  ticket.workerUrl = "";

  allocatedCount++;
  recentWaitTimes.push(ticket.allocatedAt - ticket.createdAt);
  if (recentWaitTimes.length > MAX_WAIT_TIME_SAMPLES) {
    recentWaitTimes.shift();
  }
}

export function getTicket(ticketId: string): Ticket | null {
  return tickets.get(ticketId) || null;
}

export function getMatchmakingMetrics() {
  // Generate some synthetic historical metrics to make the chart look alive if empty
  if (tickets.size === 0) {
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

  // Bolt Optimization: Calculate P95 over bounded rolling sample buffer instead of sorting all historical tickets
  const sorted = [...recentWaitTimes].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95WaitTimeMs = sorted.length > 0 ? sorted[p95Index] : 0;

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
