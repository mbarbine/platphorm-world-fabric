import { ZoneHandoffManager, Zone } from "../../src/runtime/zone/ZoneHandoff.ts";

async function runTest() {
  const source: Zone = { id: "zone_a", region: "us-east" };
  const dest: Zone = { id: "zone_b", region: "us-east" };
  
  const manager = new ZoneHandoffManager("player_123", source, dest);
  
  if (manager.getState() !== "SOURCE_OWNED") throw new Error("Initial state mismatch");
  
  const success = await manager.executeHandoff({ id: "player_123", x: 0, y: 0 });
  
  if (!success) throw new Error("Handoff failed");
  if (manager.getState() !== "SOURCE_RELEASED") throw new Error("Final state mismatch");
  
  console.log("Zone handoff test PASSED");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
