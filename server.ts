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

  // Setup CORS for integrations
  app.use(cors({
    origin: ['https://quake.platphormnews.com', 'https://frwf.platphormnews.com'],
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
