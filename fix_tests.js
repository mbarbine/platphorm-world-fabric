import fs from 'fs';
import path from 'path';

function fixContent(content) {
  let updated = content;

  // 1. Fix multi-line .on(...) event listeners missing ');' after their closing brace
  // Search for pattern: .on(..., (...) => {
  const onRegex = /\.on\s*\(\s*['"][^'"]+['"]\s*,\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*\{/g;
  let match;
  
  // We process matches from right to left (reverse order of position) so string indices remain valid
  const matches = [];
  while ((match = onRegex.exec(updated)) !== null) {
    matches.push(match.index + match[0].length - 1); // index of opening '{'
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const openBraceIdx = matches[i];
    let depth = 1;
    let closeBraceIdx = -1;
    let inString = false;
    let stringChar = '';

    for (let j = openBraceIdx + 1; j < updated.length; j++) {
      const char = updated[j];
      const prevChar = updated[j - 1];

      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
        continue;
      }

      if (char === "'" || char === '"' || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = j;
          break;
        }
      }
    }

    if (closeBraceIdx !== -1) {
      // Check what follows closeBraceIdx
      const after = updated.slice(closeBraceIdx + 1);
      const afterTrim = after.trimStart();
      if (!afterTrim.startsWith(');') && !afterTrim.startsWith(')')) {
        // Missing ');'
        updated = updated.slice(0, closeBraceIdx + 1) + ');' + updated.slice(closeBraceIdx + 1);
      } else if (afterTrim.startsWith(')') && !afterTrim.startsWith(');')) {
        // Missing ';'
        const closingParenIdx = closeBraceIdx + 1 + after.indexOf(')');
        updated = updated.slice(0, closingParenIdx + 1) + ';' + updated.slice(closingParenIdx + 1);
      }
    }
  }

  // 2. Fix missing closing brackets / semicolons for promises / single line event listeners
  // Example: new Promise((resolve) => ws.on("open", resolve))
  updated = updated.replace(/(new\s+Promise\s*\([^)]*=>\s*ws\.on\([^)]+\)\s*\)?)(?!\s*;)/g, '$1;');
  updated = updated.replace(/(new\s+Promise\s*\([^)]*=>\s*ws\.on\(['"][^'"]+['"]\s*,\s*resolve)(?!\s*\);|\s*\))/g, '$1));');

  return updated;
}

const integrationDir = path.join(process.cwd(), 'tests', 'integration');
const files = fs.readdirSync(integrationDir).filter(f => f.endsWith('.ts'));

for (const f of files) {
  const filePath = path.join(integrationDir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = fixContent(content);

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${f}`);
  } else {
    console.log(`Verified: ${f}`);
  }
}
