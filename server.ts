import { controlPlaneRouter } from "./src/control-plane/api.ts";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import { startRuntime } from "./src/runtime/gameLoop.ts";
import { WebSocketTransportProvider } from "./src/transport/WebSocketTransport.ts";
import { WebRTCTransportProvider } from "./src/transport/WebRTCTransport.ts";
import { TransportChannel } from "./src/transport/TransportContract.ts";
import { fetchMcpTools, callMcpTool } from "./src/chat/mcpClient.ts";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

class CompositeTransportProvider {
  private connectionHandlers: ((channel: TransportChannel) => void)[] = [];

  constructor(providers: { start(): void; onConnection(h: (channel: TransportChannel) => void): void }[]) {
    for (const p of providers) {
      p.onConnection((c) => {
        for (const h of this.connectionHandlers) h(c);
      });
      p.start();
    }
  }

  start() {}
  onConnection(handler: (channel: TransportChannel) => void): void {
    this.connectionHandlers.push(handler);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const server = http.createServer(app);
  
  // Set up signaling and fallback WebSocket servers on different paths
  const wsServer = new WebSocketServer({ noServer: true });
  const signalingServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url;
    if (pathname === '/ws') {
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request);
      });
    } else if (pathname === '/webrtc-signaling') {
      signalingServer.handleUpgrade(request, socket, head, (ws) => {
        signalingServer.emit('connection', ws, request);
      });
    }
  });

  const wsTransport = new WebSocketTransportProvider(wsServer);
  const rtcTransport = new WebRTCTransportProvider(signalingServer);
  
  const compositeProvider = new CompositeTransportProvider([wsTransport, rtcTransport]);

  // Start the authoritative game runtime using the composite provider
  startRuntime(compositeProvider);

  // API routes FIRST
  app.use(express.json());
  app.use("/api/control-plane", controlPlaneRouter);

  // Setup CORS for integrations
  app.use(cors({
    origin: [
      'https://quake.platphormnews.com', 
      'https://frwf.platphormnews.com',
      'https://trace.platphormnews.com',
      'https://mcp.platphormews.com',
      'https://mcp.platphormnews.com',
      'https://platphormnews.com',
      'https://games.platphormnews.com',
      'https://paperboy.platphormnews.com'
    ],
    credentials: true,
  }));

  // Integration webhook/API endpoint
  app.post("/api/integration/webhook", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.PLATPHORM_API_KEY}`) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
      return;
    }
    
    // Process integration data here
    console.log("Received integration payload:", req.body);
    res.json({ status: "success", received: true });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, history } = req.body;
      const mcpTools = await fetchMcpTools();
      
      const functionDeclarations = mcpTools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }));

      // Initialize Gemini Chat session
      const chat = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          thinkingConfig: { thinkingLevel: 'HIGH' } as any, // Add thinking mode as required
          tools: [{ functionDeclarations }],
        },
        history: history || [],
      });

      let response = await chat.sendMessage({ message: prompt });
      
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of response.functionCalls) {
          try {
            const result = await callMcpTool(call.name, call.args);
            functionResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { result }
              }
            });
          } catch (e: any) {
            functionResponses.push({
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { error: e.message }
              }
            });
          }
        }
        response = await chat.sendMessage(functionResponses);
      }

      res.json({ response: response.text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
