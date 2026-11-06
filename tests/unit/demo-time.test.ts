import { describe, expect, it } from "vitest";
import {
  DAY0_ISO,
  dateKey,
  fmtDay,
  fmtDur,
  fmtHM,
  fmtT,
  hoursToIso,
  isoToHours,
  wallClockH,
} from "@/domain/demo-time";

describe("demo time", () => {
  it("hour 0 is the epoch, shown in Singapore time", () => {
    expect(hoursToIso(0)).toBe(DAY0_ISO);
    expect(fmtT(0)).toBe("Mon 16 Nov, 17:00");
    expect(fmtDay(0)).toBe("Mon 16 Nov");
    expect(fmtHM(0)).toBe("17:00");
  });

  it("follows the real clock to the minute", () => {
    const ms = Date.parse("2026-10-31T06:05:00.000Z");
    const h = wallClockH(ms);
    expect(hoursToIso(h)).toBe("2026-10-31T06:05:00.000Z");
    expect(fmtT(h)).toBe("Sat 31 Oct, 14:05");
  });

  it("groups by the Singapore date, not the UTC one", () => {
    // 20:00 UTC on 16 Nov is 04:00 on 17 Nov in Singapore.
    expect(dateKey(11)).toBe("2026-11-17");
    expect(dateKey(0)).toBe("2026-11-16");
  });

  it("round-trips hours, including negative and fractional ones", () => {
    for (const h of [-50, -1, 0, 26, 576, 1.5, -382.25])
      expect(isoToHours(hoursToIso(h))).toBe(h);
  });

  it("formats durations like the mockup", () => {
    expect(fmtDur(5.5)).toBe("5 h 30 min");
    expect(fmtDur(47)).toBe("47 h 00 min");
    expect(fmtDur(1.999)).toBe("2 h 00 min");
    expect(fmtDur(72)).toBe("3.0 days");
  });
});
