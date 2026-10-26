import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  computeClocks,
  type ClockCase,
} from "@/domain/clocks";
import { loadRulePack } from "@/domain/rule-pack";

const pack = loadRulePack("v1");
const T0 = new Date("2026-11-02T00:00:00.000Z");
const plus = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const highCase: ClockCase = {
  detectedAt: T0.toISOString(),
  highSince: T0.toISOString(),
  materialityDeterminedAt: null,
  closedAt: null,
  tier: "HIGH",
};
const byId = (c: ClockCase, now: Date) =>
  Object.fromEntries(computeClocks(c, pack, now).map((k) => [k.id, k]));

describe("addBusinessDays", () => {
  it("Fri 2026-11-06 + 4 = Thu 2026-11-12", () =>
    expect(
      addBusinessDays(new Date("2026-11-06T09:30:00.000Z"), 4).toISOString(),
    ).toBe("2026-11-12T09:30:00.000Z"));
  it("Sat + 1 = Mon", () =>
    expect(
      addBusinessDays(new Date("2026-11-07T00:00:00.000Z"), 1).toISOString(),
    ).toBe("2026-11-09T00:00:00.000Z"));
});

describe("computeClocks", () => {
  it("US-10: shows every pack clock with start and due", () => {
    const ks = computeClocks(highCase, pack, plus(10));
    expect(ks.map((k) => k.id)).toEqual(pack.clocks.map((c) => c.id));
    const g = ks.find((k) => k.id === "GDPR_33")!;
    expect(g.startedAt).toBe(T0.toISOString());
    expect(g.dueAt).toBe(plus(72).toISOString());
    expect(g.label).toMatch(/GDPR/);
  });
  it("SEC not_started until materiality, with days since detection", () => {
    const k = byId(highCase, plus(50))["SEC_1_05"]!;
    expect(k.status).toBe("not_started");
    expect(k.dueAt).toBeNull();
    expect(k.note).toBe(
      "Materiality not yet determined — 2 days since detection",
    );
  });
  it("SEC runs 4 business days from materiality", () => {
    const m = new Date("2026-11-06T10:00:00.000Z");
    const k = byId(
      { ...highCase, materialityDeterminedAt: m.toISOString() },
      m,
    )["SEC_1_05"]!;
    expect(k.status).toBe("running");
    expect(k.dueAt).toBe("2026-11-12T10:00:00.000Z");
  });
  it("GDPR running at 53h, due_soon at 54h (75% of 72h)", () => {
    expect(byId(highCase, plus(53))["GDPR_33"]!.status).toBe("running");
    const k = byId(highCase, plus(54))["GDPR_33"]!;
    expect(k.status).toBe("due_soon");
    expect(k.pctElapsed).toBe(75);
  });
  it("classify SLA stops once the case is HIGH, runs while LOW", () => {
    expect(byId(highCase, plus(100))["INT_CLASSIFY"]!.status).toBe("stopped");
    const low: ClockCase = { ...highCase, highSince: null, tier: "LOW" };
    expect(byId(low, plus(100))["INT_CLASSIFY"]!.status).toBe("overdue");
  });
  it("overdue after due", () =>
    expect(byId(highCase, plus(73))["GDPR_33"]!.status).toBe("overdue"));
  it("PDPA is 3 calendar days from high_since", () =>
    expect(byId(highCase, plus(1))["PDPA_26D"]!.dueAt).toBe(
      plus(72).toISOString(),
    ));
  it("closed case → all stopped", () => {
    const ks = computeClocks(
      { ...highCase, closedAt: plus(5).toISOString() },
      pack,
      plus(100),
    );
    expect(ks.every((k) => k.status === "stopped")).toBe(true);
  });
  it("LOW case INT_DECIDE and PDPA not_started", () => {
    const low: ClockCase = { ...highCase, highSince: null, tier: "LOW" };
    const ks = byId(low, plus(5));
    expect(ks["INT_DECIDE"]!.status).toBe("not_started");
    expect(ks["PDPA_26D"]!.status).toBe("not_started");
  });
});
