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

  async append(event: Omit<WorldEvent, 'timestamp'>): Promise<WorldEvent> {
    const fullEvent = { ...event, timestamp: Date.now() };
    this.events.push(fullEvent);
    console.log(`[EventStore] Appended event ${event.type} to ${event.aggregateId}`);
    return fullEvent;
  }

  async getEvents(aggregateId: string): Promise<WorldEvent[]> {
    return this.events.filter(e => e.aggregateId === aggregateId);
  }
}

export const defaultEventStore = new InMemoryEventStore();
