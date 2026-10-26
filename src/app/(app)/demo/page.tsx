import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/server/db/client";
import { demoSettings } from "@/server/db/schema";
import { assertDemoMode } from "@/server/demo";
import { REPLAY_PRESETS } from "@/server/demo/replay-presets";
import { requireActor } from "@/server/page-guard";
import { advanceAction, fireAction, resetAction } from "./actions";
import { ResetButton } from "./ResetButton";

async function Panel() {
  try {
    assertDemoMode();
  } catch {
    notFound(); // our NotFound class would render as a 500
  }
  await requireActor("viewDemo");
  const [settings] = await db.select().from(demoSettings);
  const offsetHours = (settings?.offsetMs ?? 0) / 3_600_000;
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Demo panel</h1>
      <p>Mode: DEMO_MODE on. Clock offset: +{offsetHours}h (illustrative).</p>
      <ul className="flex flex-col gap-2">
        {Object.entries(REPLAY_PRESETS).map(([name, p]) => (
          <li key={name}>
            <form action={fireAction}>
              <input type="hidden" name="preset" value={name} />
              <button type="submit" className="border px-3 py-1">
                {p.label}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={advanceAction}>
        <button type="submit" className="border px-3 py-1">
          Advance +24h
        </button>
      </form>
      <ResetButton action={resetAction} />
    </main>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}
