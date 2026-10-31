/** One deadline row on the case page (mockup: startClocks()). Hours since Day 0. */
export type Clock = {
  key: "class" | "mat" | "gdpr" | "ca" | "sec" | "pdpa";
  name: string;
  start: number | null;
  dur: number | null;
  met?: boolean;
  note?: string;
};

// "What the rules require today": these post-date 2016 and are illustrative.
export function clocksFrom(start: number | null): Clock[] {
  if (start === null) return [];
  return [
    { key: "class", name: "Classify (internal)", start, dur: 24, met: true },
    { key: "mat", name: "Decide materiality (internal)", start, dur: 48 },
    { key: "gdpr", name: "GDPR Art. 33", start, dur: 72 },
    {
      key: "ca",
      name: "California Civ. Code 1798.82",
      start,
      dur: null,
      note: "No fixed hours",
    },
    {
      key: "sec",
      name: "SEC 8-K Item 1.05",
      start: null,
      dur: null,
      note: "4 business days after materiality decision",
    },
    {
      key: "pdpa",
      name: "Singapore PDPA",
      start: null,
      dur: null,
      note: "3 days after assessed notifiable",
    },
  ];
}

/** Hours left on the GDPR window, or null if it has not started. */
export function gdprRemaining(clocks: Clock[], now: number): number | null {
  const g = clocks.find((k) => k.key === "gdpr");
  return g && g.start !== null && g.dur !== null ? g.start + g.dur - now : null;
}
