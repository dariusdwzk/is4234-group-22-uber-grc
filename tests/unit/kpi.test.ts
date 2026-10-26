import { describe, expect, it } from "vitest";
import { UBER_2016, daysToBoard } from "@/domain/kpi";

describe("daysToBoard", () => {
  it("same instant = 0", () => {
    expect(daysToBoard("2026-11-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z")).toBe(0);
  });
  it("rounds to one decimal", () => {
    expect(daysToBoard("2026-11-01T00:00:00.000Z", "2026-11-02T12:00:00.000Z")).toBe(1.5);
    expect(daysToBoard("2026-11-01T00:00:00.000Z", "2026-11-01T01:00:00.000Z")).toBe(0);
    expect(daysToBoard("2026-11-01T00:00:00.000Z", "2026-11-01T05:00:00.000Z")).toBe(0.2);
  });
  it("never negative", () => {
    expect(daysToBoard("2026-11-02T00:00:00.000Z", "2026-11-01T00:00:00.000Z")).toBe(0);
  });
  it("Uber 2016 constant", () => {
    expect(UBER_2016.detectionToDisclosureDays).toBe(371);
    expect(UBER_2016.note).toContain("no board involvement");
  });
});
