export function getRegionalMetrics() {
  // Generate some synthetic regional metrics
  return [
    {
      region: "us-east-1",
      status: "HEALTHY",
      playerCount: 1245 + Math.floor(Math.random() * 50),
      capacity: 2000,
      p95LatencyMs: 35 + Math.floor(Math.random() * 15),
    },
    {
      region: "us-west-2",
      status: "HEALTHY",
      playerCount: 890 + Math.floor(Math.random() * 40),
      capacity: 1500,
      p95LatencyMs: 42 + Math.floor(Math.random() * 12),
    },
    {
      region: "eu-central-1",
      status: "DEGRADED",
      playerCount: 420 + Math.floor(Math.random() * 20),
      capacity: 1000,
      p95LatencyMs: 145 + Math.floor(Math.random() * 30),
    },
    {
      region: "ap-northeast-1",
      status: "HEALTHY",
      playerCount: 230 + Math.floor(Math.random() * 15),
      capacity: 500,
      p95LatencyMs: 85 + Math.floor(Math.random() * 10),
    }
  ];
}
