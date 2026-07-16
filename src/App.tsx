/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnyMessage, MessageType, Snapshot, EntityState } from './protocol/messages';
import { encodeMessage, decodeMessage } from './protocol/binaryCodec';
import { SmartClientTransport } from './transport/ClientTransport';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function RssFeedWidget() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/rss')
      .then(r => r.text())
      .then(str => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, 'text/xml');
        const itemNodes = doc.querySelectorAll('item');
        const parsed = Array.from(itemNodes).map(node => ({
          title: node.querySelector('title')?.textContent,
          description: node.querySelector('description')?.textContent,
          pubDate: node.querySelector('pubDate')?.textContent,
        }));
        setItems(parsed);
      })
      .catch(e => console.error("RSS fetch error:", e));
  }, []);
  
  return (
    <div className="flex flex-col border border-white/10 bg-black/50 p-4 gap-2 w-full max-w-md mt-4">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">News Feed</h3>
      {items.length === 0 && <div className="text-[10px] text-gray-500">Loading feed...</div>}
      {items.map((item, i) => (
        <div key={i} className="text-[10px] font-mono text-gray-500 border-l-2 border-[#00FF41]/30 pl-2">
          <div className="text-[#00FF41]">{item.title}</div>
          <div className="line-clamp-2">{item.description}</div>
        </div>
      ))}
    </div>
  );
}

function AIChatWidget() {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const handleSend = async () => {
    if (!prompt) return;
    setLoading(true);
    const userMsg = { role: 'user', parts: [{ text: prompt }] };
    const currentHistory = [...history];
    setHistory([...currentHistory, userMsg]);
    setPrompt('');
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, history: currentHistory })
      });
      const data = await res.json();
      if (data.response) {
        setHistory([...currentHistory, userMsg, { role: 'model', parts: [{ text: data.response }] }]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };
  
  return (
    <div className="flex flex-col border border-white/10 bg-black/50 p-4 gap-2 w-full max-w-md mt-4 h-64">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex justify-between">
        <span>AI Agent (High Thinking)</span>
        {loading && <span className="text-[#00FF41] animate-pulse">Thinking...</span>}
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2 text-[10px] font-mono" ref={scrollRef}>
        {history.length === 0 && <div className="text-gray-600">Ask the AI about game servers, modes, or stats via MCP...</div>}
        {history.map((msg, i) => (
          <div key={i} className={`p-2 ${msg.role === 'user' ? 'text-white text-right' : 'text-[#00FF41] text-left border-l border-[#00FF41]/30 bg-[#00FF41]/5'}`}>
            {msg.parts[0].text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          className="flex-1 bg-black border border-white/20 text-white px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#00FF41]"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Analyze Quake servers..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading} className="px-2 py-1 bg-[#00FF41]/20 text-[#00FF41] hover:bg-[#00FF41]/40 text-[10px] font-bold">
          SEND
        </button>
      </div>
    </div>
  );
}

function getConnectionQuality(ping: number, loss: number) {
  if (ping < 100 && loss < 2) return 'Good';
  if (ping < 200 && loss < 10) return 'Fair';
  return 'Poor';
}

function ConnectionQualityBars({ quality }: { quality: 'Good' | 'Fair' | 'Poor' }) {
  const bars = quality === 'Good' ? 3 : quality === 'Fair' ? 2 : 1;
  const color = quality === 'Good' ? 'bg-[#00FF41]' : quality === 'Fair' ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-end gap-[2px] h-3">
      <div className={`w-1 h-1.5 ${bars >= 1 ? color : 'bg-gray-700'}`}></div>
      <div className={`w-1 h-2 ${bars >= 2 ? color : 'bg-gray-700'}`}></div>
      <div className={`w-1 h-3 ${bars >= 3 ? color : 'bg-gray-700'}`}></div>
    </div>
  );
}

interface LogEvent {
  id: number;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success';
}

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [transportType, setTransportType] = useState<string>('None');
  const [clientId, setClientId] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntityState[]>([]);
  const transportRef = useRef<SmartClientTransport | null>(null);

  // App Phase State
  type AppPhase = 'Lobby' | 'Matchmaking' | 'Game';
  const [phase, setPhase] = useState<AppPhase>('Lobby');
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [lobby, setLobby] = useState<any>(null);
  const [joinLobbyInput, setJoinLobbyInput] = useState<string>('');

  useEffect(() => {
    setMyPlayerId(Math.random().toString(36).substring(7));
  }, []);

  const handleCreateLobby = async () => {
    const res = await fetch('/api/control-plane/lobbies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myPlayerId })
    });
    const data = await res.json();
    const lob = await fetch(`/api/control-plane/lobbies/${data.id}`).then(r => r.json());
    setLobby(lob);
  };

  const handleJoinLobby = async () => {
    if (!joinLobbyInput) return;
    const res = await fetch(`/api/control-plane/lobbies/${joinLobbyInput}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: myPlayerId })
    });
    if (res.ok) {
      const data = await res.json();
      setLobby(data);
    } else {
      addLog("Lobby not found", "error");
    }
  };

  const startMatchmaking = async () => {
    setPhase('Matchmaking');
    const res = await fetch('/api/control-plane/matchmaking/ticket', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyId: lobby.id })
    });
    const { ticketId } = await res.json();
    
    const interval = setInterval(async () => {
      const ticketRes = await fetch(`/api/control-plane/matchmaking/ticket/${ticketId}`);
      const ticket = await ticketRes.json();
      if (ticket.status === 'allocated') {
        clearInterval(interval);
        setPhase('Game');
        connect(ticket.workerUrl);
      }
    }, 1000);
  };

  // Stats
  const [tickDuration, setTickDuration] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0);
  const [packetLossHistory, setPacketLossHistory] = useState<{ time: string, loss: number }[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<{ time: string, p95: number }[]>([]);
  const pingSamplesRef = useRef<number[]>([]);
  const messagesCountRef = useRef(0);
  const lastSnapshotRef = useRef<number>(performance.now());
  const highestTickRef = useRef<number>(0);
  const totalExpectedRef = useRef<number>(0);
  const totalReceivedRef = useRef<number>(0);
  
  const [eventLog, setEventLog] = useState<LogEvent[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [matchmakingHistory, setMatchmakingHistory] = useState<{ time: string, queueDepth: number, p95: number, allocated: number, failed: number }[]>([]);
  const [regionalMetrics, setRegionalMetrics] = useState<{ region: string, status: string, playerCount: number, capacity: number, p95LatencyMs: number }[]>([]);
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [mmRes, rmRes] = await Promise.all([
          fetch('/api/control-plane/matchmaking/metrics'),
          fetch('/api/control-plane/regions')
        ]);
        
        if (rmRes.ok) {
          const rmData = await rmRes.json();
          setRegionalMetrics(rmData);
        }

        if (mmRes.ok) {
          const data = await mmRes.json();
          setMatchmakingHistory(prev => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            
            const newHistory = [...prev, {
              time: timeStr,
              queueDepth: data.queueDepth,
              p95: data.p95WaitTimeMs,
              allocated: data.status.allocated,
              failed: data.status.failed,
            }];
            
            if (newHistory.length > 30) return newHistory.slice(newHistory.length - 30);
            return newHistory;
          });
        }
      } catch (e) {
        // ignore fetch errors
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setEventLog(prev => {
      const newLog = [...prev, { id: logIdRef.current++, timestamp: new Date(), message, type }];
      if (newLog.length > 50) return newLog.slice(newLog.length - 50);
      return newLog;
    });
  }, []);

  // Auto-scroll event log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventLog]);

  const connect = useCallback(async (workerUrl?: string) => {
    let url = workerUrl;
    if (!url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      url = `${protocol}//${window.location.host}`;
    }
    const transport = new SmartClientTransport(url);
    transportRef.current = transport;

    setConnectionStatus('Connecting...');
    addLog('Initiating connection to cluster...', 'info');

    try {
      await transport.start();
      setConnectionStatus('Connected');
      setTransportType(transport.getStatus());
      addLog(`Connected via ${transport.getStatus().toUpperCase()}`, 'success');
      
      transport.send(encodeMessage({
        type: MessageType.ClientHello,
        clientId: myPlayerId,
        version: '1.0.0'
      }));

      transport.onMessage((data) => {
        messagesCountRef.current++;
        try {
          const msg = decodeMessage(data) as AnyMessage;
          
          if (msg.type === MessageType.ServerHello) {
            setClientId(msg.connectionId);
            addLog(`Assigned Client ID: ${msg.connectionId}`, 'info');
          } else if (msg.type === MessageType.Snapshot) {
            setEntities(msg.entities);
            const now = performance.now();
            setTickDuration(now - lastSnapshotRef.current);
            lastSnapshotRef.current = now;

            if (highestTickRef.current === 0) {
              highestTickRef.current = msg.serverTick;
              totalExpectedRef.current += 1;
              totalReceivedRef.current += 1;
            } else if (msg.serverTick > highestTickRef.current) {
              const diff = msg.serverTick - highestTickRef.current;
              totalExpectedRef.current += diff;
              totalReceivedRef.current += 1;
              highestTickRef.current = msg.serverTick;
            } else {
              totalReceivedRef.current += 1;
            }
          } else if (msg.type === MessageType.Pong) {
            const p = performance.now() - msg.clientTime;
            setPingMs(p);
            pingSamplesRef.current.push(p);
            if (pingSamplesRef.current.length > 100) {
              pingSamplesRef.current.shift();
            }
          }
        } catch (e) {
          console.error("Parse error", e);
        }
      });

      transport.onClose(() => {
        setConnectionStatus('Disconnected');
        setTransportType('None');
        setClientId(null);
        addLog('Connection closed', 'error');
      });
    } catch (e) {
      setConnectionStatus('Failed');
      setTransportType('None');
      addLog(`Connection failed: ${e}`, 'error');
      console.error(e);
    }
  }, [addLog]);

  useEffect(() => {
    if (phase !== 'Game') return;

    const statsInterval = setInterval(() => {
      setMessagesReceived(messagesCountRef.current);
      messagesCountRef.current = 0;

      if (totalExpectedRef.current > 0) {
        const loss = Math.max(0, totalExpectedRef.current - totalReceivedRef.current) / totalExpectedRef.current;
        const lossVal = loss * 100;
        setPacketLoss(lossVal);
        setPacketLossHistory(prev => {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          const newHistory = [...prev, { time: timeStr, loss: lossVal }];
          if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
          return newHistory;
        });
      } else {
        setPacketLoss(0);
        setPacketLossHistory(prev => {
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          const newHistory = [...prev, { time: timeStr, loss: 0 }];
          if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
          return newHistory;
        });
      }
      totalExpectedRef.current = 0;
      totalReceivedRef.current = 0;

      // P95 Latency Calculation
      let currentP95 = 0;
      if (pingSamplesRef.current.length > 0) {
        const sorted = [...pingSamplesRef.current].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        currentP95 = sorted[p95Index] || 0;
      }
      
      setLatencyHistory(prev => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newHistory = [...prev, { time: timeStr, p95: currentP95 }];
        if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
        return newHistory;
      });
      
    }, 1000);

    const pingInterval = setInterval(() => {
      if (transportRef.current && 
          transportRef.current.getStatus() !== 'Disconnected' && 
          transportRef.current.getStatus() !== 'Connecting' && 
          transportRef.current.getStatus() !== 'Failed') {
        transportRef.current.send(encodeMessage({
          type: MessageType.Ping,
          clientTime: performance.now()
        }));
      }
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(pingInterval);
      if (transportRef.current) {
        transportRef.current.close();
      }
    };
  }, [connect]);

  const inputSequenceRef = useRef(1);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Handle inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      keysPressed.current[e.key.toLowerCase()] = true;
      keysPressed.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.key] = false;
    };
    const handleBlur = () => {
      keysPressed.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    const inputInterval = setInterval(() => {
      if (!transportRef.current || transportRef.current.getStatus() === 'Disconnected') return;
      
      let x = 0;
      let y = 0;
      if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) y = -1;
      if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) y = 1;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) x = -1;
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) x = 1;
      
      if (x !== 0 || y !== 0) {
        transportRef.current.send(encodeMessage({
          type: MessageType.InputFrame,
          sequence: inputSequenceRef.current++,
          inputX: x,
          inputY: y
        }));
      }
    }, 1000 / 30); // 30Hz

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      clearInterval(inputInterval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0B0E] text-[#E0E0E0] font-sans overflow-hidden">
      <header className="flex flex-col justify-center px-6 py-4 border-b border-white/10 bg-[#0F1117] shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-white uppercase mb-1">PLATPHORM <span className="font-light opacity-50">// REALTIME WORLD FABRIC</span></h1>
        <p className="text-[10px] font-mono text-[#00FF41]/80 tracking-widest uppercase">PLATFORM SUPPORTING INFRASTRUCTURE</p>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {phase === 'Lobby' && (
          <div className="flex-1 flex flex-col items-center justify-start py-10 overflow-y-auto bg-[#08090C] relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00FF41 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="z-10 bg-[#14161C] p-8 border border-white/10 flex flex-col gap-6 w-full max-w-md">
              <h2 className="text-xl font-bold tracking-widest uppercase text-white border-b border-white/10 pb-4">Lobby Terminal</h2>
              
              {!lobby ? (
                <div className="flex flex-col gap-4">
                  <button onClick={handleCreateLobby} className="w-full bg-[#00FF41]/20 hover:bg-[#00FF41]/30 text-[#00FF41] border border-[#00FF41]/50 py-3 uppercase tracking-widest text-xs font-bold transition-colors">
                    Create New Lobby
                  </button>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={joinLobbyInput} 
                      onChange={e => setJoinLobbyInput(e.target.value)} 
                      placeholder="LOBBY ID" 
                      className="flex-1 bg-black/50 border border-white/20 text-white px-4 py-2 font-mono uppercase text-xs focus:outline-none focus:border-[#00FF41]"
                    />
                    <button onClick={handleJoinLobby} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-2 uppercase tracking-widest text-xs font-bold transition-colors">
                      Join
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center text-xs font-mono border-b border-white/10 pb-2">
                    <span className="text-gray-500 uppercase">Lobby ID</span>
                    <span className="text-[#00FF41] font-bold">{lobby.id}</span>
                  </div>
                  <div className="flex flex-col gap-2 mb-4">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Players</span>
                    {lobby.players.map((p: any) => (
                      <div key={p.id} className="text-xs font-mono text-white flex justify-between items-center bg-black/30 px-3 py-2 border border-white/5">
                        <span>{p.name} {p.id === myPlayerId && "(You)"}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={startMatchmaking} className="w-full bg-[#00FF41] text-black hover:bg-[#00FF41]/90 py-3 uppercase tracking-widest text-xs font-bold transition-colors">
                    Find Match
                  </button>
                </div>
              )}
            </div>
            
            <div className="z-10 w-full max-w-md">
              <AIChatWidget />
              <RssFeedWidget />
            </div>
          </div>
        )}

        {phase === 'Matchmaking' && (
          <div className="flex-1 flex items-center justify-center bg-[#08090C] relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00FF41 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="z-10 flex flex-col items-center gap-6">
              <span className="w-8 h-8 rounded-full border-2 border-[#00FF41]/20 border-t-[#00FF41] animate-spin" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-lg font-bold tracking-widest uppercase text-[#00FF41]">Allocating Session</h2>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Evaluating Matchmaking Policies...</p>
              </div>
            </div>
          </div>
        )}

        {phase === 'Game' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
            <div className="lg:col-span-9 relative bg-[#08090C] h-full overflow-hidden flex items-center justify-center border-r border-white/10">
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{ backgroundImage: 'radial-gradient(#00FF41 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              
              {connectionStatus === 'Connected' ? (
                 entities.map(e => (
                   <div 
                     key={e.id}
                     className={`absolute w-8 h-8 rounded border border-black/50 shadow-[0_0_10px_rgba(0,255,65,0.5)] ${e.id === `player_${clientId}` ? 'bg-blue-500 shadow-blue-500/50' : 'bg-[#00FF41]'} transition-all duration-75`}
                     style={{ 
                       transform: `translate(${e.x}px, ${e.y}px)`,
                     }}
               />
             ))
          ) : (
            <div className="text-gray-500 text-[10px] font-mono uppercase flex flex-col items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-[#00FF41]/20 border-t-[#00FF41] animate-spin" />
              Waiting for connection...
            </div>
          )}
          
          <div className="absolute bottom-4 left-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            Use Arrow Keys to move
          </div>
        </div>

        <div className="lg:col-span-3 bg-[#0D0F14] flex flex-col overflow-y-auto">
          <section className="flex flex-col border-b border-white/5">
            <div className="p-4 border-b border-white/5 bg-[#14161C]">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Diagnostics</h2>
              <p className="text-[9px] font-mono text-gray-600">CONNECTION STATE</p>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Status</span>
                <span className={`text-xs font-mono font-bold ${connectionStatus === 'Connected' ? 'text-[#00FF41]' : 'text-yellow-500'}`}>
                  {connectionStatus.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Quality</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold ${
                    getConnectionQuality(pingMs, packetLoss) === 'Good' ? 'text-[#00FF41]' : 
                    getConnectionQuality(pingMs, packetLoss) === 'Fair' ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {getConnectionQuality(pingMs, packetLoss).toUpperCase()}
                  </span>
                  <ConnectionQualityBars quality={getConnectionQuality(pingMs, packetLoss)} />
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Transport</span>
                <span className="text-xs font-mono text-white">{transportType.toUpperCase()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Ping (RTT)</span>
                <span className="text-xs font-mono text-white">{Math.round(pingMs)} ms</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Client ID</span>
                <span className="text-xs font-mono text-white">{clientId || 'N/A'}</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col border-b border-white/5">
            <div className="p-4 border-b border-white/5 bg-[#14161C]">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Telemetry</h2>
              <p className="text-[9px] font-mono text-gray-600">HOT LANE REPLICATION</p>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Update Interval (ms)</span>
                <span className="text-xs font-mono text-white">{Math.round(tickDuration)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Messages/sec</span>
                <span className="text-xs font-mono text-white">{messagesReceived}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Packet Loss</span>
                <span className={`text-xs font-mono font-bold ${packetLoss > 0 ? 'text-red-500' : 'text-[#00FF41]'}`}>
                  {packetLoss.toFixed(1)}%
                </span>
              </div>
              
              <div className="h-16 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={packetLossHistory}>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} 
                      labelStyle={{ color: '#888' }} 
                      itemStyle={{ color: '#00FF41' }} 
                    />
                    <Line type="stepAfter" dataKey="loss" stroke={packetLoss > 0 ? '#ef4444' : '#00FF41'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase">P95 Latency</span>
                <span className="text-xs font-mono text-white">
                  {latencyHistory.length > 0 ? Math.round(latencyHistory[latencyHistory.length - 1].p95) : 0} ms
                </span>
              </div>

              <div className="h-16 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyHistory}>
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} 
                      labelStyle={{ color: '#888' }} 
                      itemStyle={{ color: '#a855f7' }} 
                    />
                    <Bar dataKey="p95" fill="#a855f7" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Active Entities</span>
                <span className="text-xs font-mono text-white">{entities.length}</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col border-b border-white/5">
            <div className="p-4 border-b border-white/5 bg-[#14161C]">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Matchmaking</h2>
              <p className="text-[9px] font-mono text-gray-600">CAPACITY & ALLOCATION</p>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Queue Depth</span>
                <span className="text-xs font-mono text-white">
                  {matchmakingHistory.length > 0 ? matchmakingHistory[matchmakingHistory.length - 1].queueDepth : 0}
                </span>
              </div>
              
              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={matchmakingHistory}>
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} 
                      labelStyle={{ color: '#888' }} 
                      itemStyle={{ color: '#3b82f6' }} 
                    />
                    <Line type="monotone" dataKey="queueDepth" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase">P95 Wait Time</span>
                <span className="text-xs font-mono text-white">
                  {matchmakingHistory.length > 0 ? Math.round(matchmakingHistory[matchmakingHistory.length - 1].p95) : 0} ms
                </span>
              </div>

              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={matchmakingHistory}>
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#14161C', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} 
                      labelStyle={{ color: '#888' }} 
                      itemStyle={{ color: '#a855f7' }} 
                    />
                    <Line type="monotone" dataKey="p95" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Allocated</span>
                  <span className="text-xs font-mono text-[#00FF41]">
                    {matchmakingHistory.length > 0 ? matchmakingHistory[matchmakingHistory.length - 1].allocated : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Failed</span>
                  <span className="text-xs font-mono text-red-500">
                    {matchmakingHistory.length > 0 ? matchmakingHistory[matchmakingHistory.length - 1].failed : 0}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col border-t border-white/5">
            <div className="p-4 border-b border-white/5 bg-[#14161C]">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Regional Overview</h2>
              <p className="text-[9px] font-mono text-gray-600">CAPACITY & HEALTH</p>
            </div>
            
            <div className="p-4">
              <input 
                type="text" 
                placeholder="Filter regions..." 
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full bg-[#1A1C23] border border-white/10 text-white text-[11px] font-mono px-3 py-1.5 mb-3 rounded-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
              />
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-mono text-gray-500 border-b border-white/5">
                    <th className="pb-2 font-normal">REGION</th>
                    <th className="pb-2 font-normal">STATUS</th>
                    <th className="pb-2 font-normal text-right">PLAYERS</th>
                    <th className="pb-2 font-normal text-right">P95 (ms)</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {regionalMetrics.filter(region => region.region.toLowerCase().includes(regionFilter.toLowerCase())).map((region) => (
                    <tr key={region.region} className="border-b border-white/5 last:border-0">
                      <td className="py-2 text-white">{region.region}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1.5 ${region.status === 'HEALTHY' ? 'text-[#00FF41]' : 'text-amber-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${region.status === 'HEALTHY' ? 'bg-[#00FF41]' : 'bg-amber-500'}`} />
                          {region.status}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-300">
                        {region.playerCount} <span className="text-gray-600">/ {region.capacity}</span>
                      </td>
                      <td className="py-2 text-right text-gray-300">{region.p95LatencyMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col flex-1 min-h-0 border-t border-white/5">
            <div className="p-4 border-b border-white/5 bg-[#14161C] shrink-0">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Event Log</h2>
              <p className="text-[9px] font-mono text-gray-600">SYSTEM EVENTS</p>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {eventLog.map(log => (
                <div key={log.id} className="flex gap-3 text-xs font-mono">
                  <span className="text-gray-500 shrink-0">
                    {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`break-words ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-[#00FF41]' :
                    'text-gray-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
