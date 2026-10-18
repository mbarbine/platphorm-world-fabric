import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitTicket, getTicket, getMatchmakingMetrics } from '../../src/control-plane/matchmaker';

describe('matchmaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return synthetic metrics when no tickets exist', () => {
    const metrics = getMatchmakingMetrics();
    expect(metrics).toHaveProperty('queueDepth');
    expect(metrics).toHaveProperty('p95WaitTimeMs');
    expect(metrics.status).toBeDefined();
  });

  it('should submit a ticket, retrieve it, and update metrics on allocation', () => {
    const ticketId = submitTicket('lobby-1');
    expect(ticketId).toBeTruthy();

    const ticket = getTicket(ticketId);
    expect(ticket).not.toBeNull();
    expect(ticket?.id).toBe(ticketId);
    expect(ticket?.lobbyId).toBe('lobby-1');
    expect(ticket?.status).toBe('queued');

    const metricsDuringQueue = getMatchmakingMetrics();
    expect(metricsDuringQueue.queueDepth).toBeGreaterThanOrEqual(1);

    // Fast-forward timers to trigger allocation (2-5s timer)
    vi.advanceTimersByTime(6000);

    const allocatedTicket = getTicket(ticketId);
    expect(allocatedTicket?.status).toBe('allocated');
    expect(allocatedTicket?.assignedSessionId).toBeDefined();

    const metricsAfterAllocation = getMatchmakingMetrics();
    expect(metricsAfterAllocation.status.allocated).toBeGreaterThanOrEqual(1);
  });

  it('should return null for non-existent ticket', () => {
    expect(getTicket('non-existent-id')).toBeNull();
  });
});
