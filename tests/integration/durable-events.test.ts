import { defaultEventStore } from "../../src/persistence/EventStore.ts";

async function runTest() {
  await defaultEventStore.append({
    eventId: "ev_1",
    aggregateId: "match_123",
    type: "MATCH_START",
    payload: { players: ["p1", "p2"] }
  });

  const events = await defaultEventStore.getEvents("match_123");
  if (events.length !== 1) throw new Error("Expected 1 event");
  if (events[0].type !== "MATCH_START") throw new Error("Type mismatch");
  if (!events[0].timestamp) throw new Error("Timestamp missing");

  console.log("Durable events test PASSED");
}

runTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
