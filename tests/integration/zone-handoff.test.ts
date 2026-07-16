import { describe, it, expect } from "vitest";
import { ZoneHandoffManager } from "../../src/runtime/zone/ZoneHandoff";

describe("Zone Handoff", () => {
  it("should execute full handoff successfully", async () => {
    const handoff = new ZoneHandoffManager("player_123", { id: "zone_a", region: "us-east" }, { id: "zone_b", region: "us-east" });
    const success = await handoff.executeHandoff({ id: "player_123", x: 0, y: 0 } as any);
    expect(success).toBe(true);
    expect(handoff.getState()).toBe("SOURCE_RELEASED");
  });
});
