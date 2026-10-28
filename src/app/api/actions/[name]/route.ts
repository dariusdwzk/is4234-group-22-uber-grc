import { ACTIONS, errorResponse } from "@/server/api/actions";
import { actorFromRequest } from "@/server/actor";

// Thin: read input, pass the role on, return JSON. Permissions are checked in each command.
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/actions/[name]">,
): Promise<Response> {
  const { name } = await ctx.params;
  const run = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
  if (!run) return Response.json({ error: "Unknown action." }, { status: 404 });
  try {
    const body: unknown = await req.json().catch(() => ({}));
    const result = await run(actorFromRequest(req), body);
    return Response.json(result ?? { ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
