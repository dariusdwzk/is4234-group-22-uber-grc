import { connection } from "next/server";
import { errorResponse } from "@/server/api/actions";
import { actorFromRequest } from "@/server/actor";
import { downloadEvidence } from "@/server/queries/evidence";

/** An evidence file, for roles that may see its case. Always sent as a download, never inline. */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/evidence/[id]">,
): Promise<Response> {
  await connection();
  try {
    const { id } = await ctx.params;
    const f = await downloadEvidence(actorFromRequest(req), Number(id));
    return new Response(new Uint8Array(f.data), {
      headers: {
        "Content-Type": f.type,
        "Content-Disposition": `attachment; filename="${f.name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
