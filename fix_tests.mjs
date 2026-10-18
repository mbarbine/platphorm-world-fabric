import fs from 'fs';
import path from 'path';

const dir = 'tests/integration';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

for (const f of files) {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Fix awaitConnection syntax where missing closing parentheses or braces exist
  // e.g. const awaitConnection = (ws) => new Promise((resolve) => ws.on("open", resolve);
  content = content.replace(
    /const awaitConnection = \(([^)]+)\) => new Promise\(\(resolve\) =>\s*ws\.on\("open", resolve\);/g,
    'const awaitConnection = ($1: WebSocket) => new Promise((resolve) => {\n    ws.on("open", resolve);\n  });'
  );

  content = content.replace(
    /const awaitConnection = \(([^)]+)\) => new Promise\(\(resolve\) => \{\s*ws\.on\("open", resolve\);(?!\s*\}\);)/g,
    'const awaitConnection = ($1: WebSocket) => new Promise((resolve) => {\n    ws.on("open", resolve);\n  });'
  );

  // Clean up any double-closing });); artifact on awaitConnection
  content = content.replace(/ws\.on\("open", resolve\);\s*\}\);?\);/g, 'ws.on("open", resolve);\n  });');

  // 2. Fix client event listeners missing closing brackets/parentheses
  // Clean up orphaned }); right after client.on("message", (data) => {
  content = content.replace(/(client\d*|ws)\.on\("message",\s*\([^)]*\)\s*=>\s*\{\s*\n\}\);/g, '$1.on("message", (data) => {');

  // Ensure invalid imports in recreate_tests artifacts are converted back to existing modules
  content = content.replace(/import \{ sessionAllocator \} from "\.\.\/\.\.\/src\/session\/SessionAllocator";/g, 'import { SessionAllocator } from "../../src/allocator/SessionAllocator";');
  content = content.replace(/import \{ zoneManager \} from "\.\.\/\.\.\/src\/world\/ZoneManager";/g, 'import { ZoneHandoffManager } from "../../src/runtime/zone/ZoneHandoff";');

  // Fix session allocation test body if legacy recreate_tests string was injected
  if (f === 'session-allocation.test.ts' && content.includes('sessionAllocator.')) {
    content = `import { describe, it, expect } from "vitest";
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
`;
  }

  // Fix zone handoff test body if legacy recreate_tests string was injected
  if (f === 'zone-handoff.test.ts' && content.includes('zoneManager.')) {
    content = `import { describe, it, expect } from "vitest";
import { ZoneHandoffManager } from "../../src/runtime/zone/ZoneHandoff";

describe("Zone Handoff", () => {
  it("should execute full handoff successfully", async () => {
    const handoff = new ZoneHandoffManager("player_123", { id: "zone_a", region: "us-east" }, { id: "zone_b", region: "us-east" });
    const success = await handoff.executeHandoff({ id: "player_123", x: 0, y: 0 } as any);
    expect(success).toBe(true);
    expect(handoff.getState()).toBe("SOURCE_RELEASED");
  });
});
`;
  }

  fs.writeFileSync(filePath, content);
}

console.log("Successfully ran fix_tests.mjs");
