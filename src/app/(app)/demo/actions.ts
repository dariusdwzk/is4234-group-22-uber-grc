"use server";
import { redirect } from "next/navigation";
import { advanceClock } from "@/server/commands/advance-clock";
import { firePreset } from "@/server/commands/fire-preset";
import { resetDemo } from "@/server/commands/reset-demo";
import { assertDemoMode } from "@/server/demo";
import { REPLAY_PRESETS, type PresetName } from "@/server/demo/replay-presets";
import { requireActor } from "@/server/page-guard";

export async function fireAction(formData: FormData): Promise<void> {
  assertDemoMode();
  const actor = await requireActor("viewDemo");
  const name = String(formData.get("preset"));
  if (!Object.hasOwn(REPLAY_PRESETS, name)) throw new Error("unknown preset");
  await firePreset(actor, name as PresetName);
  redirect("/demo");
}

export async function advanceAction(): Promise<void> {
  assertDemoMode();
  const actor = await requireActor("viewDemo");
  await advanceClock(actor, { hours: 24 });
  redirect("/demo");
}

export async function resetAction(): Promise<void> {
  assertDemoMode();
  const actor = await requireActor("viewDemo");
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_PASSWORD is not set");
  await resetDemo(actor, demoPassword);
  redirect("/login"); // reset re-creates every user and session
}
