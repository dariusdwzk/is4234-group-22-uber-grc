import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { sha256Hex } from "@/domain/hash";
import type { Actor } from "@/domain/types";
import { db, type Tx } from "../db/client";
import { sessions, users } from "../db/schema";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Returns the raw token (shown to the browser once); only its SHA-256 is stored. */
export async function createSession(
  tx: Tx,
  userId: string,
  now: Date,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx.insert(sessions).values({
    tokenSha256: sha256Hex(token),
    userId,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  // Housekeeping: drop this user's expired sessions while we are writing anyway.
  await tx
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));
  return token;
}

export async function deleteSession(
  tx: Tx,
  token: string,
  userId?: string,
): Promise<void> {
  const byToken = eq(sessions.tokenSha256, sha256Hex(token));
  await tx
    .delete(sessions)
    .where(userId ? and(byToken, eq(sessions.userId, userId)) : byToken);
}

export async function actorFromToken(
  token: string | undefined,
  now: Date,
): Promise<Actor | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, role: users.role, displayName: users.displayName })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenSha256, sha256Hex(token)),
        gt(sessions.expiresAt, now),
      ),
    );
  return row ?? null;
}
