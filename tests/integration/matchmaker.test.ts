import { Matchmaker, MatchmakingTicket } from '../../src/matchmaker/Matchmaker.ts';

function runTest() {
  console.log("Starting Matchmaker Test...");
  const matchmaker = new Matchmaker();
  
  const now = Date.now();
  
  const ticket1: MatchmakingTicket = {
    ticketId: "t1",
    playerIds: ["p1"],
    gameMode: "ranked",
    skill: 1500,
    regionPreferences: ["us-east"],
    latency: { "us-east": 30, "us-west": 90 },
    queueEntryTime: now - 5000 // 5 seconds ago
  };

  const ticket2: MatchmakingTicket = {
    ticketId: "t2",
    playerIds: ["p2"],
    gameMode: "ranked",
    skill: 1580, // High difference, but wait time expands tolerance
    regionPreferences: ["us-east", "us-west"],
    latency: { "us-east": 45, "us-west": 20 },
    queueEntryTime: now
  };
  
  const ticket3: MatchmakingTicket = {
    ticketId: "t3",
    playerIds: ["p3"],
    gameMode: "unranked",
    skill: 1500,
    regionPreferences: ["us-east"],
    latency: { "us-east": 30 },
    queueEntryTime: now
  };

  matchmaker.addTicket(ticket1);
  matchmaker.addTicket(ticket2);
  matchmaker.addTicket(ticket3);

  const matches = matchmaker.tick();
  
  if (matches.length !== 1) {
    throw new Error(`Expected exactly 1 match, got ${matches.length}`);
  }
  
  const match = matches[0];
  if (match.region !== "us-east") {
    throw new Error(`Expected region us-east, got ${match.region}`);
  }
  
  const metrics = matchmaker.getMetrics();
  console.log("Metrics:", metrics);
  
  console.log("Matchmaker test PASSED.");
}

runTest();
