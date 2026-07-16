import { EntityState } from "../../protocol/messages.ts";

export type HandoffState = 
  | "SOURCE_OWNED"
  | "DESTINATION_RESERVED"
  | "STATE_PREPARED"
  | "DESTINATION_PRIMED"
  | "DUAL_REPLICATION"
  | "AUTHORITY_TRANSFERRED"
  | "CLIENT_ROUTE_UPDATED"
  | "SOURCE_RELEASED"
  | "HANDOFF_ABORTED";

export interface Zone {
  id: string;
  region: string;
}

export class ZoneHandoffManager {
  private state: HandoffState = "SOURCE_OWNED";
  private entityId: string;
  private sourceZone: Zone;
  private destZone: Zone;
  
  constructor(entityId: string, source: Zone, dest: Zone) {
    this.entityId = entityId;
    this.sourceZone = source;
    this.destZone = dest;
  }

  getState() { return this.state; }

  async executeHandoff(entityState: EntityState): Promise<boolean> {
    try {
      console.log(`[Handoff] Starting handoff for ${this.entityId} from ${this.sourceZone.id} to ${this.destZone.id}`);
      
      // 1. Reserve
      this.state = "DESTINATION_RESERVED";
      await this.simulateNetworkDelay();

      // 2. Prepare
      this.state = "STATE_PREPARED";
      await this.simulateNetworkDelay();

      // 3. Prime
      this.state = "DESTINATION_PRIMED";
      await this.simulateNetworkDelay();

      // 4. Dual Replication
      this.state = "DUAL_REPLICATION";
      await this.simulateNetworkDelay();

      // 5. Transfer Authority
      this.state = "AUTHORITY_TRANSFERRED";
      await this.simulateNetworkDelay();

      // 6. Update Client
      this.state = "CLIENT_ROUTE_UPDATED";
      await this.simulateNetworkDelay();

      // 7. Release
      this.state = "SOURCE_RELEASED";
      console.log(`[Handoff] Handoff complete for ${this.entityId}`);
      return true;

    } catch (e) {
      console.error(`[Handoff] Failed, aborting...`, e);
      this.state = "HANDOFF_ABORTED";
      return false;
    }
  }

  private simulateNetworkDelay() {
    return new Promise(resolve => setTimeout(resolve, 50));
  }
}
