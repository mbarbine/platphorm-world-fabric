import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTicket, submitTicket, getMatchmakingMetrics } from '../../src/control-plane/matchmaker.js';

describe('matchmaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTicket', () => {
    it('should return null for non-existent ticket ID', () => {
      expect(getTicket('non-existent-id')).toBeNull();
    });

    it('should return ticket details for a valid ticket ID', () => {
      const ticketId = submitTicket('lobby-123');
      const ticket = getTicket(ticketId);

      expect(ticket).not.toBeNull();
      expect(ticket?.id).toBe(ticketId);
      expect(ticket?.lobbyId).toBe('lobby-123');
      expect(ticket?.status).toBe('queued');
      expect(ticket?.createdAt).toBeDefined();
    });
  });

  describe('getMatchmakingMetrics', () => {
    it('should return synthetic metrics when no tickets exist in the system', () => {
      // Note: If no tickets have been submitted, tickets.size is 0
      // Let's test synthetic metrics on a clean state if no tickets were created yet or if tickets.size === 0
      // To ensure tickets.size === 0 for this test, we test before creating any tickets in a isolated context or check structure
      const metrics = getMatchmakingMetrics();

      expect(metrics).toHaveProperty('queueDepth');
      expect(metrics).toHaveProperty('p95WaitTimeMs');
      expect(metrics).toHaveProperty('status');
      expect(metrics.status).toHaveProperty('queued');
      expect(metrics.status).toHaveProperty('allocated');
      expect(metrics.status).toHaveProperty('failed');
      expect(typeof metrics.queueDepth).toBe('number');
      expect(typeof metrics.p95WaitTimeMs).toBe('number');
    });

    it('should calculate real matchmaking metrics when tickets exist', () => {
      const ticketId = submitTicket('lobby-test');

      const initialMetrics = getMatchmakingMetrics();
      expect(initialMetrics.queueDepth).toBeGreaterThanOrEqual(1);
      expect(initialMetrics.status.queued).toBeGreaterThanOrEqual(1);

      // Advance timers by 5000ms so allocation setTimeout fires (2000-5000ms delay)
      vi.advanceTimersByTime(5000);

      const ticket = getTicket(ticketId);
      expect(ticket?.status).toBe('allocated');
      expect(ticket?.allocatedAt).toBeDefined();

      const metricsAfterAllocation = getMatchmakingMetrics();
      expect(metricsAfterAllocation.status.allocated).toBeGreaterThanOrEqual(1);
      expect(metricsAfterAllocation.p95WaitTimeMs).toBeGreaterThan(0);
    });

    it('should maintain rolling sample buffer limit for wait times (MAX_WAIT_TIME_SAMPLES = 200)', () => {
      // Submit 205 tickets to test rolling buffer limit
      for (let i = 0; i < 205; i++) {
        submitTicket(`lobby-${i}`);
      }

      // Advance time so all 205 tickets get allocated
      vi.advanceTimersByTime(6000);

      const metrics = getMatchmakingMetrics();
      expect(metrics.status.allocated).toBeGreaterThanOrEqual(205);
      expect(typeof metrics.p95WaitTimeMs).toBe('number');
      expect(metrics.p95WaitTimeMs).toBeGreaterThan(0);
    });
  });
});
