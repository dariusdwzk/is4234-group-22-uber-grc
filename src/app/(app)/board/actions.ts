"use server";
import { redirect } from "next/navigation";
import { acknowledgeTier2 } from "@/server/commands/acknowledge-tier2";
import { resolveFlag } from "@/server/commands/resolve-flag";
import {
  Conflict,
  Forbidden,
  NotFound,
  ValidationError,
} from "@/server/errors";
import { requireActor } from "@/server/page-guard";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

async function back(go: () => Promise<unknown>, to: string): Promise<never> {
  let error = "";
  try {
    await go();
  } catch (e) {
    if (
      e instanceof Forbidden ||
      e instanceof Conflict ||
      e instanceof NotFound ||
      e instanceof ValidationError
    )
      error = "?error=INVALID";
    else throw e;
  }
  redirect(`${to}${error}`);
}

export async function acknowledgeAction(f: FormData): Promise<void> {
  const actor = await requireActor("viewBoard");
  await back(
    () =>
      acknowledgeTier2(actor, {
        itemId: str(f, "itemId"),
        actionNote: str(f, "actionNote"),
      }),
    "/board",
  );
}

/** Used from both /board (ACC) and /flag (ACC, IA). */
export async function resolveFlagAction(f: FormData): Promise<void> {
  const actor = await requireActor("resolveFlag");
  await back(
    () =>
      resolveFlag(actor, {
        flagId: str(f, "flagId"),
        resolution: str(f, "resolution"),
      }),
    str(f, "from") === "board" ? "/board" : "/flag",
  );
}
