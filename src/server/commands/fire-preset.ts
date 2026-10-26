import "server-only";
import { eq } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { db } from "../db/client";
import { users } from "../db/schema";
import { getNow } from "../clock";
import { assertDemoMode } from "../demo";
import { REPLAY_PRESETS, type PresetName } from "../demo/replay-presets";
import { Forbidden } from "../errors";
import { logRefusal } from "../run-command";
import { declareIncident } from "./declare-incident";
import { ingestEvent } from "./ingest-event";

/** The demo operator fires a preset; the declaration preset runs as the seeded EMP user. */
export async function firePreset(
  actor: Actor,
  name: PresetName,
): Promise<void> {
  assertDemoMode();
  const preset = REPLAY_PRESETS[name];
  if (preset.type === "ingest") {
    await ingestEvent(actor, {
      kind: preset.kind,
      occurredAt: (await getNow()).toISOString(),
      correlationKey: preset.correlationKey,
      payload: preset.payload,
    });
    return;
  }
  const auth = authorize(actor, "ingestEvent"); // same DEMO-only gate as the other presets
  if (!auth.ok) {
    await logRefusal(actor, "ingestEvent", auth.reason);
    throw new Forbidden(auth.reason);
  }
  const [emp] = await db
    .select({ id: users.id, role: users.role, displayName: users.displayName })
    .from(users)
    .where(eq(users.email, "emp@demo.test"));
  if (!emp) throw new Error("seeded EMP user missing; run the seed first");
  await declareIncident(emp, {
    description: preset.description,
    relatedReference: preset.relatedReference,
  });
}
