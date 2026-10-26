"use server";
import { redirect } from "next/navigation";
import { raiseFlag } from "@/server/commands/raise-flag";
import { ValidationError } from "@/server/errors";
import { requireActor } from "@/server/page-guard";

export async function raiseFlagAction(f: FormData): Promise<void> {
  const actor = await requireActor("raiseFlag");
  try {
    await raiseFlag(actor, {
      caseRef: String(f.get("caseRef") ?? ""),
      text: String(f.get("text") ?? ""),
    });
  } catch (e) {
    if (e instanceof ValidationError) redirect("/flag?error=INVALID");
    throw e;
  }
  // Same answer whether or not the reference matched a case.
  redirect("/flag?recorded=1");
}
