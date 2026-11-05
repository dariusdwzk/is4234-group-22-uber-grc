import { afterEach, describe, expect, it, vi } from "vitest";
import { navFor } from "@/client/nav";
import { loadRole, saveRole, emptyState } from "@/client/store";
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { initials } from "@/client/views/shell";
import type { CaseView, ViewState } from "@/domain/view-state";

const d = emptyState();
const c = (o: object) => ({ route: "NORMAL", status: "Open", ...o });
// Two shown on the GC page (independent, high-risk), one filtered out (low-risk, normal route).
const three = {
  ...d,
  cases: [
    c({ route: "INDEPENDENT", severity: "LOW" }),
    c({ severity: "HIGH" }),
    c({ severity: "LOW" }),
  ] as CaseView[],
};

describe("navFor", () => {
  it("board: two items, the evidence log current", () => {
    const n = navFor("board", { view: "board", boardTab: "log", d });
    expect(n.map((i) => i.label)).toEqual(["Overview", "Evidence log"]);
    expect(n.map((i) => i.current)).toEqual([false, true]);
  });
  it("gc: All cases counts only the cases its page lists (not all three)", () => {
    const n = navFor("gc", {
      view: "approvals",
      boardTab: "overview",
      d: three,
    });
    expect(n).toEqual([
      { label: "My work", a: "go", x: "work", count: 1, current: false },
      { label: "All cases", a: "go", x: "approvals", count: 2, current: true },
    ]);
  });
  it("employee: report an incident", () => {
    expect(
      navFor("employee", { view: "case", boardTab: "overview", d }),
    ).toEqual([
      { label: "Report an incident", a: "go", x: "employee", current: false },
    ]);
  });
  it("board: Overview counts notices not yet acknowledged, omitted at 0", () => {
    const n = (ack: number | null) =>
      ({ id: "N", ack }) as unknown as ViewState["notices"][number];
    const w = (notices: ViewState["notices"]) =>
      navFor("board", {
        view: "board",
        boardTab: "overview",
        d: { ...d, notices },
      })[0]!;
    expect(w([n(null), n(5), n(null)]).count).toBe(2);
    expect(w([n(5)])).not.toHaveProperty("count");
  });
  it("case page: the sidebar marks the item the breadcrumb links to", () => {
    const pend = {
      type: "T",
      need: 2,
      disclose: false,
      status: "Pending",
      votes: {},
    };
    const waiting = { id: "C-1", severity: "HIGH", decision: pend };
    const other = { id: "C-2", severity: "HIGH", decision: null };
    const dd = { ...d, cases: [waiting, other] as unknown as CaseView[] };
    const cur = (caseId: string) =>
      navFor("gc", { view: "case", boardTab: "overview", d: dd, caseId })
        .filter((i) => i.current)
        .map((i) => i.label);
    expect(cur("C-1")).toEqual(["My work"]);
    expect(cur("C-2")).toEqual(["All cases"]);
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
