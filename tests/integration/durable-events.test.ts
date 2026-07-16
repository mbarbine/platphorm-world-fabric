import { describe, it, expect } from "vitest";
import { defaultEventStore } from "../../src/persistence/EventStore";

describe("Durable Events", () => {
  it("should append and retrieve events", async () => {
    await defaultEventStore.append({
      eventId: "ev_" + Date.now(),
      aggregateId: "match_123",
      type: "MATCH_START",
      payload: { players: ["p1", "p2"] }
    });
    
    const events = await defaultEventStore.getEvents("match_123");
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe("MATCH_START");
  });
});
