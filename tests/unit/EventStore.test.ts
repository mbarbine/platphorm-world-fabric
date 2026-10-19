import { describe, it, expect } from 'vitest';
import { InMemoryEventStore, defaultEventStore } from '../../src/persistence/EventStore';

describe('InMemoryEventStore', () => {
  it('should append an event and populate timestamp', async () => {
    const store = new InMemoryEventStore();
    const startTime = Date.now();

    const eventInput = {
      eventId: 'evt_1',
      aggregateId: 'player_100',
      type: 'PLAYER_JOINED',
      payload: { name: 'Alice' }
    };

    const appendedEvent = await store.append(eventInput);

    expect(appendedEvent.eventId).toBe('evt_1');
    expect(appendedEvent.aggregateId).toBe('player_100');
    expect(appendedEvent.type).toBe('PLAYER_JOINED');
    expect(appendedEvent.payload).toEqual({ name: 'Alice' });
    expect(typeof appendedEvent.timestamp).toBe('number');
    expect(appendedEvent.timestamp).toBeGreaterThanOrEqual(startTime);
    expect(appendedEvent.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should retrieve appended events for a given aggregateId in order', async () => {
    const store = new InMemoryEventStore();

    await store.append({
      eventId: 'evt_1',
      aggregateId: 'match_1',
      type: 'MATCH_STARTED',
      payload: { mode: 'pvp' }
    });

    await store.append({
      eventId: 'evt_2',
      aggregateId: 'match_1',
      type: 'PLAYER_SCORED',
      payload: { playerId: 'p1', points: 10 }
    });

    await store.append({
      eventId: 'evt_3',
      aggregateId: 'match_1',
      type: 'MATCH_ENDED',
      payload: { winner: 'p1' }
    });

    const events = await store.getEvents('match_1');

    expect(events).toHaveLength(3);
    expect(events[0].eventId).toBe('evt_1');
    expect(events[0].type).toBe('MATCH_STARTED');
    expect(events[1].eventId).toBe('evt_2');
    expect(events[1].type).toBe('PLAYER_SCORED');
    expect(events[2].eventId).toBe('evt_3');
    expect(events[2].type).toBe('MATCH_ENDED');
  });

  it('should return empty array for an aggregateId with no events', async () => {
    const store = new InMemoryEventStore();

    const events = await store.getEvents('non_existent_aggregate');

    expect(events).toEqual([]);
  });

  it('should maintain aggregate isolation when multiple aggregates have events', async () => {
    const store = new InMemoryEventStore();

    await store.append({
      eventId: 'evt_a1',
      aggregateId: 'agg_A',
      type: 'EVENT_A',
      payload: { value: 1 }
    });

    await store.append({
      eventId: 'evt_b1',
      aggregateId: 'agg_B',
      type: 'EVENT_B',
      payload: { value: 2 }
    });

    await store.append({
      eventId: 'evt_a2',
      aggregateId: 'agg_A',
      type: 'EVENT_A_2',
      payload: { value: 3 }
    });

    const eventsA = await store.getEvents('agg_A');
    const eventsB = await store.getEvents('agg_B');

    expect(eventsA).toHaveLength(2);
    expect(eventsA.map(e => e.eventId)).toEqual(['evt_a1', 'evt_a2']);

    expect(eventsB).toHaveLength(1);
    expect(eventsB.map(e => e.eventId)).toEqual(['evt_b1']);
  });

  it('should export defaultEventStore as an instance of InMemoryEventStore', () => {
    expect(defaultEventStore).toBeInstanceOf(InMemoryEventStore);
    expect(typeof defaultEventStore.append).toBe('function');
    expect(typeof defaultEventStore.getEvents).toBe('function');
  });
});
