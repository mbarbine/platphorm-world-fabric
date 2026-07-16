/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnyMessage, MessageType, Snapshot, EntityState } from './protocol/messages';
import { encodeMessage, decodeMessage } from './protocol/binaryCodec';
import { SmartClientTransport } from './transport/ClientTransport';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

  // Stats
  const [tickDuration, setTickDuration] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0);
  const [packetLossHistory, setPacketLossHistory] = useState<{ time: string, loss: number }[]>([]);
  const messagesCountRef = useRef(0);
  const lastSnapshotRef = useRef<number>(performance.now());
  const highestTickRef = useRef<number>(0);
  const totalExpectedRef = useRef<number>(0);
  const totalReceivedRef = useRef<number>(0);
  
  const [eventLog, setEventLog] = useState<LogEvent[]>([]);
  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

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

  const connect = useCallback(async () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const transport = new SmartClientTransport(`${protocol}//${window.location.host}`);
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
        clientId: 'browser_client',
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
            setPingMs(performance.now() - msg.clientTime);
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
    connect();
    
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

  // Handle inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!transportRef.current || transportRef.current.getStatus() === 'Disconnected') return;
      
      let x = 0;
      let y = 0;
      if (e.key === 'ArrowUp') y = -1;
      if (e.key === 'ArrowDown') y = 1;
      if (e.key === 'ArrowLeft') x = -1;
      if (e.key === 'ArrowRight') x = 1;
      
      if (x !== 0 || y !== 0) {
        transportRef.current.send(encodeMessage({
          type: MessageType.InputFrame,
          sequence: 1, // Basic sequence
          inputX: x,
          inputY: y
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0B0E] text-[#E0E0E0] font-sans overflow-hidden">
      <header className="flex flex-col justify-center px-6 py-4 border-b border-white/10 bg-[#0F1117] shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-white uppercase mb-1">PLATPHORM <span className="font-light opacity-50">// REALTIME WORLD FABRIC</span></h1>
        <p className="text-[10px] font-mono text-[#00FF41]/80 tracking-widest uppercase">PLATFORM SUPPORTING INFRASTRUCTURE</p>
      </header>

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
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Active Entities</span>
                <span className="text-xs font-mono text-white">{entities.length}</span>
              </div>
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
    </div>
  );
}
