import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
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
    <main className="p-6 lg:p-8">
      <PageHeader title="Demo panel" />
      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <p className="text-sm text-ink">
            Mode: DEMO_MODE on. Clock offset: +{offsetHours}h (illustrative).
          </p>
        </Card>
        <Card titleId="replay" title="Replay scenario">
          <ol className="flex flex-col gap-2">
            {Object.entries(REPLAY_PRESETS).map(([name, p]) => (
              <li key={name}>
                <form action={fireAction}>
                  <input type="hidden" name="preset" value={name} />
                  <SubmitButton variant="secondary" className="w-full justify-start text-left">
                    {p.label}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Clock" as="section">
          <form action={advanceAction}>
            <SubmitButton variant="secondary">Advance +24h</SubmitButton>
          </form>
        </Card>
        <Card
          titleId="reset"
          title="Reset"
          className="border-danger-ink! bg-danger-soft!"
        >
          <ResetButton action={resetAction} />
        </Card>
      </div>
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
