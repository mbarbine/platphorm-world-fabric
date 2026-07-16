import fs from 'fs';

const files = fs.readdirSync('tests/integration').filter(f => f.endsWith('.ts'));

for (const f of files) {
  let content = fs.readFileSync('tests/integration/' + f, 'utf8');
  
  // Clean up the vitest mess
  content = content.replace(/import { describe, it, expect } from "vitest";/, '');
  content = content.replace(/describe\("Integration Tests", \(\) => {\s*it\("should run the test successfully", async \(\) => { {/g, 'async function runTest() {');
  content = content.replace(/  }, 20000);\n\/\/ Removed runTest\(\)\s*      }, 20000);\n}\);/g, '');
  content = content.replace(/  }, 20000);\n}\);/g, '');
  
  // Now add back vitest correctly
  content = "import { describe, it, expect } from 'vitest';\n" + content;
  content = content.replace(/async function runTest\(\) {/g, 'describe("Integration", () => {\n  it("should run", async () => {');
  
  // We need to fix the missing brackets in awaitConnection and event listeners
  content = content.replace(/const awaitConnection = \(ws: WebSocket\) => new Promise\(\(resolve\) => \{\s*ws\.on\("open", resolve\);/g, 'const awaitConnection = (ws: WebSocket) => new Promise((resolve) => {\n    ws.on("open", resolve);\n  });');
  
  // For client1.on("message", ...
  // This is hard to do with regex. I will just download them and replace manually, or use a simpler approach.
}
