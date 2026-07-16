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
});
