import { describe, expect, it } from "vitest";
import { homeFor, navLinks } from "@/domain/nav";

const hrefs = (r: Parameters<typeof navLinks>[0]) =>
  navLinks(r).map((l) => l.href);

describe("navLinks", () => {
  it("EMP sees only the report page", () => {
    expect(hrefs("EMP")).toEqual(["/report", "/flag"]);
  });
  it("SA sees cases and report, never board, ledger or demo", () => {
    expect(hrefs("SA")).toEqual(["/cases", "/report", "/flag"]);
  });
  it("ACC sees report, board and ledger", () => {
    expect(hrefs("ACC")).toEqual(["/report", "/board", "/flag", "/ledger"]);
  });
  it("only DEMO sees /demo", () => {
    expect(hrefs("DEMO")).toContain("/demo");
    expect(hrefs("IA")).not.toContain("/demo");
  });
  it("homeFor gives the first link", () => {
    expect(homeFor("GC")).toBe("/cases");
    expect(homeFor("EMP")).toBe("/report");
    expect(homeFor("DEMO")).toBe("/demo");
  });
});
