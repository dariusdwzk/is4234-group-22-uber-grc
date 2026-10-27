import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const t: Record<string, string> = {};
for (const [, k, v] of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) t[k as string] = v as string;

const lum = (hex: string) => {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
};
const ratio = (a: string, b: string) => {
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
// white at alpha a over a token colour, as SidebarLinks does (bg-white/10, bg-white/5)
const over = (bg: string, a: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(255 * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const hex = (k: string): string => {
  if (k === "white") return "#FFFFFF";
  if (k === "black") return "#000000";
  if (k === "amber-200") return "#FDE68A"; // Tailwind default; Banner.tsx
  const m = /^sidebar\+white\/(\d+)$/.exec(k);
  if (m) return over(t.sidebar as string, Number(m[1]) / 100);
  return t[k] ?? "";
};

const AA: [string, string][] = [
  ["ink", "canvas"], ["ink", "surface"], ["muted", "surface"], ["muted", "canvas"],
  ["white", "brand"], ["white", "brand-hover"], ["sidebar-ink", "sidebar"],
  ["white", "sidebar+white/10"], ["sidebar-ink", "sidebar+white/5"],
  ["ink", "neutral-soft"], ["muted", "neutral-soft"], ["neutral-ink", "neutral-soft"],
  ["brand", "surface"], ["danger-ink", "surface"], ["white", "danger-ink"], ["black", "amber-200"],
  ...["danger", "warn", "ok", "info", "neutral"].map((v): [string, string] => [`${v}-ink`, `${v}-soft`]),
];
const UI: [string, string][] = [["field", "surface"], ["ring", "surface"]];

describe("theme contrast", () => {
  it.each(AA)("%s on %s >= 4.5", (fg, bg) => {
    expect(hex(fg), fg).not.toBe("");
    expect(hex(bg), bg).not.toBe("");
    expect(ratio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(UI)("%s on %s >= 3", (fg, bg) => {
    expect(hex(fg), fg).not.toBe("");
    expect(ratio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });
});
