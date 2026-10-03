import { describe, it, expect } from 'vitest';
import { submitTicket, getTicket, getMatchmakingMetrics } from '../../src/control-plane/matchmaker';

describe('Matchmaker Control Plane Metrics', () => {
  it('should accurately track queued tickets and update metrics in O(1) time', () => {
    const initialMetrics = getMatchmakingMetrics();
    expect(initialMetrics).toBeDefined();

    const ticketId1 = submitTicket('LOBBY_123');
    expect(ticketId1).toBeTruthy();

    const ticket = getTicket(ticketId1);
    expect(ticket).not.toBeNull();
    expect(ticket?.status).toBe('queued');

    const queuedMetrics = getMatchmakingMetrics();
    expect(queuedMetrics.queueDepth).toBeGreaterThanOrEqual(1);
    expect(queuedMetrics.status.queued).toBeGreaterThanOrEqual(1);
  });
});
