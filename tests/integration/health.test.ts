import { describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";

// connection() only works inside a Next request scope; the handler itself is a plain function.
vi.mock("next/server", () => ({ connection: async () => {} }));

describe("health endpoint", () => {
  it("health ok when DB reachable", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  });
});
