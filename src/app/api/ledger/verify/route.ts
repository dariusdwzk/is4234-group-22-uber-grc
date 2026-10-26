import { connection } from "next/server";
import { verifyChain } from "@/server/ledger/verify";

// Public and read-only by design: exposes only counts, hashes and the first failing seq.
export async function GET(): Promise<Response> {
  await connection(); // opt out of build-time prerendering: probe live per request
  try {
    return Response.json(await verifyChain());
  } catch {
    return Response.json(
      { ok: false, error: "verification unavailable" },
      { status: 503 },
    );
  }
}
