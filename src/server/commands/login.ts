import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../db/schema";
import { createSession } from "../auth/session";
import { setSessionCookie } from "../auth/actor";
import { hashPassword, verifyPassword } from "../auth/password";
import { runCommand, type CommandDef } from "../run-command";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const GENERIC_LOGIN_ERROR = "Invalid email or password";

const schema = z.strictObject({
  email: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(200),
});

export type LoginResult = { ok: true; token: string } | { ok: false };

// Verified against when the email is unknown, so unknown and known accounts cost the same.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

/**
 * Failures must persist (counter + ledger), so this handler returns a result instead of
 * throwing: a throw would roll the transaction back and lose the audit trail.
 */
export const loginCommand: CommandDef<z.infer<typeof schema>, LoginResult> = {
  action: "login",
  schema,
  handler: async ({ tx, now, log }, { email, password }) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .for("update");
    if (!user) {
      await verifyPassword(password, await getDummyHash());
      await log("LOGIN_FAILED", { email }, { actorId: null });
      return { ok: false };
    }

    const lockExpired = user.lockedUntil !== null && user.lockedUntil <= now;
    if (user.lockedUntil !== null && !lockExpired) {
      // Locked: do not even evaluate the password, so the right one gives no signal.
      await log(
        "LOGIN_FAILED",
        { email, reason: "locked" },
        { actorId: user.id },
      );
      return { ok: false };
    }
    const priorFailures = lockExpired ? 0 : user.failedLogins;

    if (!(await verifyPassword(password, user.passwordHash))) {
      const failedLogins = priorFailures + 1;
      const lock = failedLogins >= MAX_FAILED_LOGINS;
      await tx
        .update(users)
        .set({
          failedLogins: lock ? 0 : failedLogins,
          lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : null,
        })
        .where(eq(users.id, user.id));
      await log(
        "LOGIN_FAILED",
        { email, ...(lock ? { reason: "locked_now" } : {}) },
        { actorId: user.id },
      );
      return { ok: false };
    }

    await tx
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
    const token = await createSession(tx, user.id, now);
    await log("LOGIN_OK", { userId: user.id }, { actorId: user.id });
    return { ok: true, token };
  },
};

/** Server-action entry point: runs the command, then sets the cookie. */
export async function performLogin(raw: unknown): Promise<boolean> {
  const result = await runCommand(loginCommand, null, raw);
  if (!result.ok) return false;
  await setSessionCookie(result.token);
  return true;
}
