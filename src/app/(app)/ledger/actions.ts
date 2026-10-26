"use server";
import { redirect } from "next/navigation";
import { exportLedgerHead } from "@/server/commands/export-head";
import { tamperEntry } from "@/server/commands/tamper-entry";
import { assertDemoMode } from "@/server/demo";
import { Conflict, Forbidden, ValidationError } from "@/server/errors";
import { requireActor } from "@/server/page-guard";

export async function exportAction(): Promise<void> {
  const actor = await requireActor("viewLedger");
  let error = "";
  try {
    await exportLedgerHead(actor);
  } catch (e) {
    if (e instanceof Forbidden) error = "?error=FORBIDDEN";
    else if (e instanceof Conflict) error = "?error=CONFLICT";
    else throw e;
  }
  redirect(`/ledger${error}`);
}

export async function tamperAction(f: FormData): Promise<void> {
  assertDemoMode();
  const actor = await requireActor("viewLedger");
  let error = "";
  try {
    await tamperEntry(actor, { seq: Number(f.get("seq")) });
  } catch (e) {
    if (e instanceof Forbidden || e instanceof ValidationError)
      error = "?error=INVALID";
    else throw e; // NotFound (no such entry) surfaces as a 404
  }
  redirect(`/ledger${error}`);
}
