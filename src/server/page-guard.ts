import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Actor } from "@/domain/types";
import { getActor } from "./auth/actor";
import { authorize, type Action } from "./authz";
import { logRefusal } from "./run-command";

/** Testable core: takes the actor instead of reading the cookie. Deny by default. */
export async function guardActor(
  actor: Actor | null,
  action: Action,
): Promise<Actor> {
  if (!actor) redirect("/login");
  const auth = authorize(actor, action);
  if (!auth.ok) {
    await logRefusal(actor, action, auth.reason);
    notFound(); // 404, not 403: do not confirm that the page exists
  }
  return actor;
}

/** Every page in (app) calls this first. */
export async function requireActor(action: Action): Promise<Actor> {
  return guardActor(await getActor(), action);
}
