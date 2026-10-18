import { describe, it, expect } from "vitest";
import { SessionAllocator } from "../../src/allocator/SessionAllocator";

describe("Session Allocation", () => {
  it("should allocate and drain sessions", () => {
    const allocator = new SessionAllocator();
    allocator.registerNode("node-1", "us-east", 10);
    
    const sess1 = allocator.requestSession("us-east");
    expect(sess1.state).toBe("ACTIVE");
    
    allocator.drainNode("node-1");
    expect(sess1.state).toBe("DRAINING");
  });

  describe("drainNode edge cases", () => {
    it("should handle draining a non-existent node ID gracefully without side-effects", () => {
      const allocator = new SessionAllocator();
      allocator.registerNode("node-1", "us-east", 10);
      const sess1 = allocator.requestSession("us-east");
      expect(sess1.state).toBe("ACTIVE");

      expect(() => allocator.drainNode("invalid-node-id")).not.toThrow();
      expect(sess1.state).toBe("ACTIVE");
      expect(allocator.getSession(sess1.id)?.state).toBe("ACTIVE");
    });

    it("should only transition ACTIVE sessions when draining a node", () => {
      const allocator = new SessionAllocator();
      allocator.registerNode("node-1", "us-east", 10);

      const sess1 = allocator.requestSession("us-east");
      const sess2 = allocator.requestSession("us-east");

      allocator.transitionSession(sess1.id, "CLOSED");
      expect(sess1.state).toBe("CLOSED");
      expect(sess2.state).toBe("ACTIVE");

      allocator.drainNode("node-1");

      expect(sess1.state).toBe("CLOSED");
      expect(sess2.state).toBe("DRAINING");
    });

    it("should isolate session draining to the specified node only", () => {
      const allocator = new SessionAllocator();
      allocator.registerNode("node-1", "us-east", 1);
      allocator.registerNode("node-2", "us-east", 1);

      const sess1 = allocator.requestSession("us-east");
      const sess2 = allocator.requestSession("us-east");

      expect(sess1.nodeId).toBe("node-1");
      expect(sess2.nodeId).toBe("node-2");

      allocator.drainNode("node-1");

      expect(sess1.state).toBe("DRAINING");
      expect(sess2.state).toBe("ACTIVE");
    });

    it("should execute idempotently when drainNode is called repeatedly", () => {
      const allocator = new SessionAllocator();
      allocator.registerNode("node-1", "us-east", 10);

      const sess1 = allocator.requestSession("us-east");
      expect(sess1.state).toBe("ACTIVE");

      allocator.drainNode("node-1");
      expect(sess1.state).toBe("DRAINING");

      expect(() => allocator.drainNode("node-1")).not.toThrow();
      expect(sess1.state).toBe("DRAINING");
    });
  });
});
