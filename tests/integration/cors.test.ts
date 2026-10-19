import { describe, it, expect } from "vitest";

describe("CORS Security Whitelist", () => {
  it("should allow valid origin https://mcp.platphormnews.com", async () => {
    const response = await fetch("http://localhost:3000/api/health", {
      headers: { Origin: "https://mcp.platphormnews.com" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://mcp.platphormnews.com");
  });

  it("should reject typo origin https://mcp.platphormews.com", async () => {
    const response = await fetch("http://localhost:3000/api/health", {
      headers: { Origin: "https://mcp.platphormews.com" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
