import { SessionAllocator } from "../../src/allocator/SessionAllocator.ts";

async function runTest() {
  const allocator = new SessionAllocator();
  
  allocator.registerNode("node_1", "us-east");
  allocator.registerNode("node_2", "eu-west");

  const s1 = allocator.requestSession("us-east");
  if (s1.state !== "ACTIVE" || s1.nodeId !== "node_1") {
    throw new Error("Failed to allocate to us-east node");
  }

  const s2 = allocator.requestSession("eu-west");
  if (s2.state !== "ACTIVE" || s2.nodeId !== "node_2") {
    throw new Error("Failed to allocate to eu-west node");
  }

  // Test draining
  allocator.drainNode("node_1");
  if ((s1.state as string) !== "DRAINING") {
    throw new Error("Session on drained node did not transition to DRAINING");
  }

  console.log("Session allocation and draining test PASSED");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
