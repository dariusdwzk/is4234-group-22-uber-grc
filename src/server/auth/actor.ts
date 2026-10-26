import "server-only";
import { cookies } from "next/headers";
import type { Actor } from "@/domain/types";
import { getNow } from "../clock";
import { actorFromToken, SESSION_TTL_MS } from "./session";

export const SESSION_COOKIE = "__Host-session";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The signed-in actor for this request, or null. Authorisation still happens in runCommand. */
export async function getActor(): Promise<Actor | null> {
  return actorFromToken(await getSessionToken(), await getNow());
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true, // required by the __Host- prefix
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
