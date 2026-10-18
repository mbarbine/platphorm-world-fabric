import { describe, it, expect } from 'vitest';
import { createLobby, joinLobby, getLobby } from '../../src/control-plane/lobby';

describe('lobby management', () => {
  describe('createLobby', () => {
    it('should create a new lobby with the creator as initial player', () => {
      const playerId = 'player123456';
      const lobbyId = createLobby(playerId);

      expect(lobbyId).toBeDefined();
      expect(typeof lobbyId).toBe('string');
      expect(lobbyId.length).toBeGreaterThan(0);

      const lobby = getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby).toEqual({
        id: lobbyId,
        players: [
          {
            id: playerId,
            name: `Player_${playerId.substring(0, 4)}`,
            isReady: false
          }
        ],
        status: 'waiting'
      });
    });
  });

  describe('getLobby', () => {
    it('should return null for non-existent lobby ID', () => {
      const lobby = getLobby('NON_EXISTENT_ID');
      expect(lobby).toBeNull();
    });

    it('should return the correct lobby for a valid lobby ID', () => {
      const playerId = 'playerABC';
      const lobbyId = createLobby(playerId);

      const lobby = getLobby(lobbyId);
      expect(lobby).not.toBeNull();
      expect(lobby?.id).toBe(lobbyId);
    });
  });

  describe('joinLobby', () => {
    it('should add a new player to an existing lobby', () => {
      const hostId = 'hostPlayer';
      const lobbyId = createLobby(hostId);

      const joiningPlayerId = 'joinPlayer';
      const updatedLobby = joinLobby(lobbyId, joiningPlayerId);

      expect(updatedLobby).not.toBeNull();
      expect(updatedLobby?.players).toHaveLength(2);
      expect(updatedLobby?.players[1]).toEqual({
        id: joiningPlayerId,
        name: `Player_${joiningPlayerId.substring(0, 4)}`,
        isReady: false
      });
    });

    it('should not add duplicate players if player rejoins', () => {
      const hostId = 'hostPlayer';
      const lobbyId = createLobby(hostId);

      const updatedLobby = joinLobby(lobbyId, hostId);

      expect(updatedLobby).not.toBeNull();
      expect(updatedLobby?.players).toHaveLength(1);
      expect(updatedLobby?.players[0].id).toBe(hostId);
    });

    it('should return null when trying to join a non-existent lobby', () => {
      const result = joinLobby('INVALID_LOBBY', 'somePlayer');
      expect(result).toBeNull();
    });
  });
});
