import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/server/db/client";

export async function GET(): Promise<Response> {
  await connection(); // opt out of build-time prerendering: probe live per request
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    // No error detail: this endpoint is public.
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
