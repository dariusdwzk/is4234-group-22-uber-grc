import { afterEach, describe, expect, it } from "vitest";
import { navFor } from "@/client/nav";
import { loadRole, saveRole, emptyState } from "@/client/store";
import { ROLE_KEYS } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";

const d = emptyState();
const three = { ...d, cases: [{}, {}, {}] as CaseView[] };

describe("navFor", () => {
  it("board: two items, the evidence log current", () => {
    const n = navFor("board", { view: "board", boardTab: "log", d });
    expect(n.map((i) => i.label)).toEqual(["Overview", "Evidence log"]);
    expect(n.map((i) => i.current)).toEqual([false, true]);
  });
  it("gc: All cases with the case count", () => {
    const n = navFor("gc", {
      view: "approvals",
      boardTab: "overview",
      d: three,
    });
    expect(n).toEqual([
      { label: "All cases", a: "go", x: "approvals", count: 3, current: true },
    ]);
  });
  it("employee: report an incident", () => {
    expect(
      navFor("employee", { view: "case", boardTab: "overview", d }),
    ).toEqual([
      { label: "Report an incident", a: "go", x: "employee", current: false },
    ]);
  });
  it("every role has at least one item", () => {
    for (const r of ROLE_KEYS)
      expect(
        navFor(r, { view: "x", boardTab: "overview", d }).length,
      ).toBeGreaterThan(0);
  });
});

describe("loadRole / saveRole", () => {
  afterEach(() => {
    // @ts-expect-error remove the stub
    delete globalThis.sessionStorage;
  });
  it("returns null when sessionStorage throws", () => {
    globalThis.sessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadRole()).toBeNull();
  });
  it("round-trips a role", () => {
    const m = new Map<string, string>();
    globalThis.sessionStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    } as unknown as Storage;
    saveRole("cso");
    expect(loadRole()).toBe("cso");
  });
});
