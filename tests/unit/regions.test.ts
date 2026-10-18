import { describe, it, expect } from 'vitest';
import { getRegionalMetrics } from '../../src/control-plane/regions';

describe('getRegionalMetrics', () => {
  it('should return synthetic regional metrics array with expected regions', () => {
    const metrics = getRegionalMetrics();

    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics).toHaveLength(4);

    const regions = metrics.map((m) => m.region);
    expect(regions).toEqual([
      'us-east-1',
      'us-west-2',
      'eu-central-1',
      'ap-northeast-1',
    ]);
  });

  it('should return valid metric objects with correct structure, types, and values', () => {
    const metrics = getRegionalMetrics();

    const expectedRanges: Record<
      string,
      {
        status: string;
        capacity: number;
        minPlayerCount: number;
        maxPlayerCount: number;
        minLatency: number;
        maxLatency: number;
      }
    > = {
      'us-east-1': {
        status: 'HEALTHY',
        capacity: 2000,
        minPlayerCount: 1245,
        maxPlayerCount: 1294,
        minLatency: 35,
        maxLatency: 49,
      },
      'us-west-2': {
        status: 'HEALTHY',
        capacity: 1500,
        minPlayerCount: 890,
        maxPlayerCount: 929,
        minLatency: 42,
        maxLatency: 53,
      },
      'eu-central-1': {
        status: 'DEGRADED',
        capacity: 1000,
        minPlayerCount: 420,
        maxPlayerCount: 439,
        minLatency: 145,
        maxLatency: 174,
      },
      'ap-northeast-1': {
        status: 'HEALTHY',
        capacity: 500,
        minPlayerCount: 230,
        maxPlayerCount: 244,
        minLatency: 85,
        maxLatency: 94,
      },
    };

    for (const item of metrics) {
      expect(item).toHaveProperty('region');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('playerCount');
      expect(item).toHaveProperty('capacity');
      expect(item).toHaveProperty('p95LatencyMs');

      expect(typeof item.region).toBe('string');
      expect(typeof item.status).toBe('string');
      expect(typeof item.playerCount).toBe('number');
      expect(typeof item.capacity).toBe('number');
      expect(typeof item.p95LatencyMs).toBe('number');

      const expected = expectedRanges[item.region];
      expect(expected).toBeDefined();

      expect(item.status).toBe(expected.status);
      expect(item.capacity).toBe(expected.capacity);

      expect(item.playerCount).toBeGreaterThanOrEqual(expected.minPlayerCount);
      expect(item.playerCount).toBeLessThanOrEqual(expected.maxPlayerCount);

      expect(item.p95LatencyMs).toBeGreaterThanOrEqual(expected.minLatency);
      expect(item.p95LatencyMs).toBeLessThanOrEqual(expected.maxLatency);
    }
  });

  it('should maintain metric properties within valid bounds across multiple invocations', () => {
    for (let i = 0; i < 20; i++) {
      const metrics = getRegionalMetrics();
      expect(metrics).toHaveLength(4);

      for (const item of metrics) {
        expect(item.playerCount).toBeGreaterThanOrEqual(0);
        expect(item.playerCount).toBeLessThanOrEqual(item.capacity);
        expect(item.p95LatencyMs).toBeGreaterThan(0);
        expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).toContain(item.status);
      }
    }
  });
});
