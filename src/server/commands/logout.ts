import "server-only";
import { z } from "zod";
import { clearSessionCookie, getActor, getSessionToken } from "../auth/actor";
import { deleteSession } from "../auth/session";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ token: z.string().min(1).max(200) });

export const logoutCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "logout",
  schema,
  handler: async ({ tx, actor, log }, { token }) => {
    await deleteSession(tx, token, actor.id); // scoped to the actor: cannot end someone else's session
    await log("LOGOUT", { userId: actor.id });
  },
};

export async function performLogout(): Promise<void> {
  const token = await getSessionToken();
  const actor = await getActor();
  if (token && actor) await runCommand(logoutCommand, actor, { token });
  await clearSessionCookie();
}
