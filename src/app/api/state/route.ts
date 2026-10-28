import { errorResponse } from "@/server/api/actions";
import { actorFromRequest } from "@/server/actor";
import { getViewState } from "@/server/queries/state";

/** Everything the current role may see, filtered on the server. */
export async function GET(req: Request): Promise<Response> {
  try {
    return Response.json(await getViewState(actorFromRequest(req)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
