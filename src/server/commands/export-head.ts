import "server-only";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { exportHead } from "../ledger/export-head";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({});

/** ACC/IA push the current head to the simulated auditor inbox (US-23). */
export const exportHeadCommand: CommandDef<
  z.infer<typeof schema>,
  { seq: number; hash: string; entryCount: number }
> = {
  action: "exportHead",
  schema,
  handler: ({ tx, actor, nowIso }) => exportHead(tx, actor.id, nowIso),
};

export const exportLedgerHead = (actor: Actor | null) =>
  runCommand(exportHeadCommand, actor, {});
