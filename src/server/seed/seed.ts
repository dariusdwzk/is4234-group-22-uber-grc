import "server-only";
import { loadRulePack } from "@/domain/rule-pack";
import type { JsonValue } from "@/domain/types";
import type { Tx } from "../db/client";
import { demoSettings, rulePacks, users } from "../db/schema";
import { writeGenesis } from "../ledger/genesis";
import { hashPassword } from "../auth/password";
import { SEED_USERS, type SeedKey } from "./users";

/** Inserts users, rule pack v1, the demo clock row and the genesis entry. Returns user ids by key. */
export async function seed(
  tx: Tx,
  opts: { demoPassword: string; now: Date },
): Promise<Record<string, string>> {
  if (opts.demoPassword.length < 12)
    throw new Error("DEMO_PASSWORD must be at least 12 characters");

  const passwordHash = await hashPassword(opts.demoPassword); // one shared password (spec §9)
  const ids: Record<string, string> = {};
  for (const [key, u] of Object.entries(SEED_USERS) as [
    SeedKey,
    (typeof SEED_USERS)[SeedKey],
  ][]) {
    if (key === "demo" && process.env.DEMO_MODE !== "true") continue;
    const [row] = await tx
      .insert(users)
      .values({
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        reportsTo: u.reportsTo ? ids[u.reportsTo] : null,
        passwordHash,
      })
      .returning({ id: users.id });
    ids[key] = row!.id;
  }

  const pack = loadRulePack("v1");
  await tx.insert(rulePacks).values({
    version: pack.version,
    body: pack as unknown as JsonValue,
    publishedAt: opts.now,
  });
  await tx
    .insert(demoSettings)
    .values({ id: 1, offsetMs: 0 })
    .onConflictDoUpdate({ target: demoSettings.id, set: { offsetMs: 0 } });
  await writeGenesis(tx, opts.now.toISOString(), pack.version);
  return ids;
}
