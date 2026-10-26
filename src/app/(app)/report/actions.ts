"use server";
import { redirect } from "next/navigation";
import { declareIncident } from "@/server/commands/declare-incident";
import { ValidationError } from "@/server/errors";
import { requireActor } from "@/server/page-guard";

export async function reportAction(formData: FormData): Promise<void> {
  const actor = await requireActor("raiseFlag"); // any signed-in user; declareIncident enforces roles
  const related = String(formData.get("relatedReference") ?? "").trim();
  let receiptId: string;
  try {
    ({ receiptId } = await declareIncident(actor, {
      description: formData.get("description"),
      ...(related ? { relatedReference: related } : {}),
    }));
  } catch (err) {
    if (err instanceof ValidationError) redirect("/report?error=1");
    throw err;
  }
  redirect(`/report?receipt=${receiptId}`);
}
