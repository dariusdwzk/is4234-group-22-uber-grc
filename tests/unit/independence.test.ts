import { describe, expect, it } from "vitest";
import { isIndependent } from "@/domain/independence";

// Seed shape from P2: ceo ← ciso ← sa; ceo ← gc ← pco; ciso ← pat.quinn
const reportsTo = new Map<string, string | null>([
  ["ceo", null],
  ["ciso", "ceo"],
  ["gc", "ceo"],
  ["sa", "ciso"],
  ["pco", "gc"],
  ["pat", "ciso"],
  ["eng", "sa"],
]);
const cisos = new Set(["ciso"]);

describe("isIndependent", () => {
  it("pco (→gc→ceo) is independent", () =>
    expect(isIndependent("pco", reportsTo, cisos)).toBe(true));
  it("US-13: pat.quinn (→ciso) is not independent", () =>
    expect(isIndependent("pat", reportsTo, cisos)).toBe(false));
  it("a user reporting to sa (→ciso) is not independent", () =>
    expect(isIndependent("eng", reportsTo, cisos)).toBe(false));
  it("the CISO themself is not independent", () =>
    expect(isIndependent("ciso", reportsTo, cisos)).toBe(false));
  it("a cycle a→b→a fails closed", () =>
    expect(
      isIndependent(
        "a",
        new Map([
          ["a", "b"],
          ["b", "a"],
        ]),
        cisos,
      ),
    ).toBe(false));
  it("an unknown user id fails closed", () =>
    expect(isIndependent("nobody", reportsTo, cisos)).toBe(false));
  it("a dangling manager id fails closed", () =>
    expect(isIndependent("x", new Map([["x", "ghost"]]), cisos)).toBe(false));
});
