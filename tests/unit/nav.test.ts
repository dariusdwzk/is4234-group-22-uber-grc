import { afterEach, describe, expect, it, vi } from "vitest";
import { navFor } from "@/client/nav";
import { loadRole, saveRole, emptyState } from "@/client/store";
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { initials } from "@/client/views/shell";
import type { CaseView } from "@/domain/view-state";

const d = emptyState();
const three = { ...d, cases: [{}, {}, {}] as CaseView[] };

describe("navFor", () => {
  it("board: two items, the evidence log current", () => {
    const n = navFor("board", { view: "board", boardTab: "log", d });
    expect(n.map((i) => i.label)).toEqual(["Overview", "Evidence log"]);
    expect(n.map((i) => i.current)).toEqual([false, true]);
  });
  it("gc: My work first, then All cases with the case count", () => {
    const n = navFor("gc", {
      view: "approvals",
      boardTab: "overview",
      d: three,
    });
    expect(n).toEqual([
      { label: "My work", a: "go", x: "work", count: 0, current: false },
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

describe("initials", () => {
  it("gives sensible initials for every role", () => {
    expect(ROLE_KEYS.map((k) => initials(ROLES[k].name))).toEqual([
      "E",
      "ST",
      "CSO",
      "GC",
      "CP",
      "CEO",
      "B",
    ]);
  });
});

describe("loadRole / saveRole", () => {
  afterEach(() => {
    // @ts-expect-error remove the stub
    delete globalThis.sessionStorage;
  });
  const stub = (o: Partial<Storage>) => {
    globalThis.sessionStorage = o as Storage;
  };
  const boom = () => {
    throw new Error("blocked");
  };
  it("returns null when sessionStorage throws", () => {
    const getItem = vi.fn(boom);
    stub({ getItem });
    expect(loadRole()).toBeNull();
    expect(getItem).toHaveBeenCalled();
  });
  it("round-trips a role", () => {
    const m = new Map<string, string>();
    stub({
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    });
    saveRole("cso");
    expect(loadRole()).toBe("cso");
  });
  it("saveRole does not throw when storage is blocked", () => {
    const setItem = vi.fn(boom);
    const removeItem = vi.fn(boom);
    stub({ setItem, removeItem });
    expect(() => saveRole("cso")).not.toThrow();
    expect(() => saveRole(null)).not.toThrow();
    expect(setItem).toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalled();
  });
});
