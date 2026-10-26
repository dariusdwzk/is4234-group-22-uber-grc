import "server-only";
import { z } from "zod";
import { SYSTEM_ACTOR } from "@/domain/types";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({});

// runCommand sweeps escalations before every handler, so the sweep itself is the work.
export const sweepCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "sweep",
  schema,
  handler: async () => undefined,
};

/** Board viewers trigger it on page load (no cron on Vercel Hobby); it runs as the system actor. */
export const sweep = () => runCommand(sweepCommand, SYSTEM_ACTOR, {});
