export async function fetchMcpTools() {
  const res = await fetch('https://quake.platphormnews.com/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
  });
  const data = await res.json();
  return data.result?.tools || [];
}

export async function callMcpTool(name: string, args: any) {
  const res = await fetch('https://quake.platphormnews.com/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      jsonrpc: '2.0', 
      method: 'tools/call', 
      params: { name, arguments: args },
      id: 2 
    })
  });
  const data = await res.json();
  return data.result;
}
