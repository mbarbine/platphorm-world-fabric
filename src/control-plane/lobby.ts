export interface Player {
  id: string;
  name: string;
  isReady: boolean;
}

export interface Lobby {
  id: string;
  players: Player[];
  status: 'waiting' | 'matchmaking' | 'in_game';
}

const lobbies = new Map<string, Lobby>();

export function createLobby(playerId: string): string {
  const id = Math.random().toString(36).substring(7).toUpperCase();
  lobbies.set(id, {
    id,
    players: [{ id: playerId, name: `Player_${playerId.substring(0, 4)}`, isReady: false }],
    status: 'waiting'
  });
  return id;
}

export function joinLobby(lobbyId: string, playerId: string): Lobby | null {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return null;
  if (!lobby.players.find(p => p.id === playerId)) {
    lobby.players.push({ id: playerId, name: `Player_${playerId.substring(0, 4)}`, isReady: false });
  }
  return lobby;
}

export function getLobby(lobbyId: string): Lobby | null {
  return lobbies.get(lobbyId) || null;
}
