export type SessionState = 
  | "REQUESTED"
  | "ALLOCATING"
  | "RESERVED"
  | "STARTING"
  | "READY"
  | "JOINABLE"
  | "ACTIVE"
  | "DRAINING"
  | "COMPLETING"
  | "CLOSED";

export interface Session {
  id: string;
  region: string;
  state: SessionState;
  nodeId?: string;
  createdAt: number;
}

export class SessionAllocator {
  private sessions = new Map<string, Session>();
  private nodes = new Map<string, { id: string, region: string, state: "WARM" | "DRAINING" | "ACTIVE", capacity: number }>();

  registerNode(id: string, region: string, capacity: number = 10) {
    this.nodes.set(id, { id, region, state: "WARM", capacity });
  }

  drainNode(id: string) {
    const node = this.nodes.get(id);
    if (node) {
      node.state = "DRAINING";
      // Find sessions on this node and drain them
      for (const session of this.sessions.values()) {
        if (session.nodeId === id && session.state === "ACTIVE") {
          this.transitionSession(session.id, "DRAINING");
        }
      }
    }
  }

  requestSession(region: string): Session {
    const id = "sess_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const session: Session = { id, region, state: "REQUESTED", createdAt: Date.now() };
    this.sessions.set(id, session);
    this.allocateSession(id);
    return session;
  }

  private allocateSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    this.transitionSession(sessionId, "ALLOCATING");

    // Bolt Optimization: Direct single-pass for...of iteration over map values to avoid intermediate array allocation via Array.from
    let node;
    for (const n of this.nodes.values()) {
      if (n.region === session.region && n.state === "WARM" && n.capacity > 0) {
        node = n;
        break;
      }
    }
    
    if (node) {
      session.nodeId = node.id;
      node.capacity--;
      this.transitionSession(sessionId, "RESERVED");
      this.transitionSession(sessionId, "READY");
      this.transitionSession(sessionId, "ACTIVE");
    } else {
      console.warn(`[Allocator] No capacity in ${session.region}`);
    }
  }

  transitionSession(id: string, newState: SessionState) {
    const session = this.sessions.get(id);
    if (session) {
      session.state = newState;
      console.log(`[Session ${id}] Transitioned to ${newState}`);
    }
  }

  getSession(id: string) {
    return this.sessions.get(id);
  }
}
