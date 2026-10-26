import "server-only";
import { NotFound } from "./errors";

/** First call in every demo command and the demo page: production must 404 (spec §9). */
export function assertDemoMode(): void {
  if (process.env.DEMO_MODE !== "true") throw new NotFound();
}
