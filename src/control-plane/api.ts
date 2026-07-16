import { Router } from 'express';
import { createLobby, joinLobby, getLobby } from './lobby.js';
import { submitTicket, getTicket, getMatchmakingMetrics } from './matchmaker.js';
import { getRegionalMetrics } from './regions.js';

export const controlPlaneRouter = Router();

controlPlaneRouter.post('/lobbies', (req, res) => {
  const { playerId } = req.body;
  if (!playerId) { res.status(400).json({ error: 'playerId required' }); return; }
  const id = createLobby(playerId);
  res.json({ id });
});

controlPlaneRouter.post('/lobbies/:id/join', (req, res) => {
  const { playerId } = req.body;
  const lobby = joinLobby(req.params.id.toUpperCase(), playerId);
  if (!lobby) { res.status(404).json({ error: 'lobby not found' }); return; }
  res.json(lobby);
});

controlPlaneRouter.get('/lobbies/:id', (req, res) => {
  const lobby = getLobby(req.params.id.toUpperCase());
  if (!lobby) { res.status(404).json({ error: 'lobby not found' }); return; }
  res.json(lobby);
});

controlPlaneRouter.post('/matchmaking/ticket', (req, res) => {
  const { lobbyId } = req.body;
  const ticketId = submitTicket(lobbyId.toUpperCase());
  res.json({ ticketId });
});

controlPlaneRouter.get('/matchmaking/ticket/:id', (req, res) => {
  const ticket = getTicket(req.params.id);
  if (!ticket) { res.status(404).json({ error: 'ticket not found' }); return; }
  res.json(ticket);
});

controlPlaneRouter.get('/matchmaking/metrics', (req, res) => {
  res.json(getMatchmakingMetrics());
});

controlPlaneRouter.get('/regions', (req, res) => {
  res.json(getRegionalMetrics());
});
