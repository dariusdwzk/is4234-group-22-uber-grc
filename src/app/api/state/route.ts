import { connection } from "next/server";
import { errorResponse } from "@/server/api/actions";
import { actorFromRequest } from "@/server/actor";
import { getViewState } from "@/server/queries/state";

/** Everything the current role may see, filtered on the server. */
export async function GET(req: Request): Promise<Response> {
  await connection(); // per request, never prerendered: the answer depends on X-Role and the DB
  try {
    return Response.json(await getViewState(actorFromRequest(req)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
