import "server-only";
import type { CommandCtx } from "./run-command";

/** Hook point: runs inside every command transaction. Filled in by P3 Task 6. */
export async function sweepEscalations(ctx: CommandCtx): Promise<void> {
  void ctx;
}
