/** "US$100,000" from integer cents (the mockup's money()). */
export const money = (cents: number): string =>
  "US$" + (cents / 100).toLocaleString("en-US");
