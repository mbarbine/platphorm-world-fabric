export interface WorldEvent {
  eventId: string;
  aggregateId: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface EventStore {
  append(event: Omit<WorldEvent, 'timestamp'>): Promise<WorldEvent>;
  getEvents(aggregateId: string): Promise<WorldEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private events: WorldEvent[] = [];
  // Bolt Optimization: Maintain a secondary Map index by aggregateId.
  // This reduces getEvents lookup complexity from O(N) linear array scan over all events down to O(1) Map lookup.
  private indexByAggregate = new Map<string, WorldEvent[]>();

  async append(event: Omit<WorldEvent, 'timestamp'>): Promise<WorldEvent> {
    const fullEvent = { ...event, timestamp: Date.now() };
    this.events.push(fullEvent);

    let aggEvents = this.indexByAggregate.get(event.aggregateId);
    if (!aggEvents) {
      aggEvents = [];
      this.indexByAggregate.set(event.aggregateId, aggEvents);
    }
    aggEvents.push(fullEvent);

    console.log(`[EventStore] Appended event ${event.type} to ${event.aggregateId}`);
    return fullEvent;
  }

  async getEvents(aggregateId: string): Promise<WorldEvent[]> {
    return this.indexByAggregate.get(aggregateId) || [];
  }
}

export const defaultEventStore = new InMemoryEventStore();
