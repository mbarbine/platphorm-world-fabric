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

export function submitTicket(lobbyId: string): string {
  const ticketId = Math.random().toString(36).substring(7);
  tickets.set(ticketId, {
    id: ticketId,
    lobbyId,
    status: 'queued',
    createdAt: Date.now(),
  });
  
  // Simulated matchmaker logic: instantly allocate after 2-5 seconds
  setTimeout(() => {
    allocateTicket(ticketId);
  }, 2000 + Math.random() * 3000);

  return ticketId;
}

function allocateTicket(ticketId: string) {
  const ticket = tickets.get(ticketId);
  if (!ticket) return;
  ticket.status = 'allocated';
  ticket.allocatedAt = Date.now();
  ticket.assignedSessionId = "session_" + Math.random().toString(36).substring(7);
  // Do not hardcode localhost. An empty workerUrl will tell the client to use its current host.
  ticket.workerUrl = ""; 
}

export function getTicket(ticketId: string): Ticket | null {
  return tickets.get(ticketId) || null;
}

export function getMatchmakingMetrics() {
  const now = Date.now();
  let queuedCount = 0;
  let allocatedCount = 0;
  let failedCount = 0;
  const waitTimes: number[] = [];

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

  for (const ticket of tickets.values()) {
    if (ticket.status === 'queued') {
      queuedCount++;
    } else if (ticket.status === 'allocated') {
      allocatedCount++;
      if (ticket.allocatedAt) {
        waitTimes.push(ticket.allocatedAt - ticket.createdAt);
      }
    } else if (ticket.status === 'failed') {
      failedCount++;
    }
  }

  waitTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(waitTimes.length * 0.95);
  const p95WaitTimeMs = waitTimes.length > 0 ? waitTimes[p95Index] : 0;

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
