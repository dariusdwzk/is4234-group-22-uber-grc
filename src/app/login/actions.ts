"use server";
import { redirect } from "next/navigation";
import { ValidationError } from "@/server/errors";
import { performLogin } from "@/server/commands/login";
import { getActor } from "@/server/auth/actor";
import { homeFor } from "@/domain/nav";

export async function loginAction(formData: FormData): Promise<void> {
  let ok = false;
  try {
    ok = await performLogin({
      email: formData.get("email"),
      password: formData.get("password"),
    });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
  }
  if (!ok) redirect("/login?error=1"); // one generic message for every failure
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/");
}
