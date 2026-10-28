import { describe, expect, it } from "vitest";
import {
  DAY0_ISO,
  JUMP_H,
  dayOf,
  fmtDur,
  fmtT,
  hoursToIso,
  isoToHours,
} from "@/domain/demo-time";

describe("demo time", () => {
  it("hour 0 is Day 0, Mon 16 Nov 2026 09:00", () => {
    expect(hoursToIso(0)).toBe(DAY0_ISO);
    expect(fmtT(0)).toBe("Mon 16 Nov, 09:00");
    expect(dayOf(0)).toBe("Day 0");
  });

  it("round-trips hours, including before Day 0", () => {
    for (const h of [-50, -1, 0, 26, JUMP_H])
      expect(isoToHours(hoursToIso(h))).toBe(h);
  });

  it("the Day 24 jump is 24 days", () => {
    expect(JUMP_H).toBe(576);
    expect(dayOf(JUMP_H)).toBe("Day 24");
  });

  it("dayOf never goes below Day 0", () => {
    expect(dayOf(-50)).toBe("Day 0");
    expect(dayOf(47)).toBe("Day 1");
  });

  it("formats durations like the mockup", () => {
    expect(fmtDur(5.5)).toBe("5 h 30 min");
    expect(fmtDur(47)).toBe("47 h 00 min");
    expect(fmtDur(72)).toBe("3.0 days");
  });
});
