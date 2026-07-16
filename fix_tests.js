const fs = require('fs');
const glob = require('glob');

const files = fs.readdirSync('tests/integration').filter(f => f.endsWith('.ts'));

for (const f of files) {
  let content = fs.readFileSync('tests/integration/' + f, 'utf8');
  
  // Re-add missing closing brackets for event listeners and promises that got stripped
  // This is a bit hacky but let's see.
  // Actually, since I ruined all '});' I might have to manually restore them, or just use the agent to fix them one by one.
  console.log(f);
}
