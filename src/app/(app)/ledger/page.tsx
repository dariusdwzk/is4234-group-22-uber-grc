import Link from "next/link";
import { Suspense } from "react";
import { authorize } from "@/server/authz";
import { verifyChain } from "@/server/ledger/verify";
import { requireActor } from "@/server/page-guard";
import { listLedger } from "@/server/queries/ledger";
import { exportAction, tamperAction } from "./actions";

async function Ledger({ searchParams }: PageProps<"/ledger">) {
  const actor = await requireActor("viewLedger");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listLedger(actor, { page });
  // verifyLedger is a read: the result is shown, never chained.
  const verify =
    sp.verify === "1" && authorize(actor, "verifyLedger").ok
      ? await verifyChain()
      : null;
  const canExport = authorize(actor, "exportHead").ok;
  const canTamper =
    process.env.DEMO_MODE === "true" && authorize(actor, "tamperEntry").ok;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <p>
        {total} entries. <span data-testid="entry-count">{total}</span>
      </p>
      {typeof sp.error === "string" && (
        <p role="alert" className="border-2 border-red-700 p-2">
          That action could not be completed.
        </p>
      )}
      <div className="my-4 flex flex-wrap items-center gap-4">
        <form method="get">
          <input type="hidden" name="verify" value="1" />
          <button type="submit" className="border px-3 py-1">
            Verify ledger
          </button>
        </form>
        {canExport && (
          <form action={exportAction}>
            <button type="submit" className="border px-3 py-1">
              Export head
            </button>
          </form>
        )}
        {canTamper && (
          <form action={tamperAction} className="flex items-center gap-2">
            <label>
              Entry number
              <input
                name="seq"
                type="number"
                min={2}
                required
                className="ml-2 w-20 border px-1"
              />
            </label>
            <button
              type="submit"
              className="border-2 border-red-700 px-3 py-1 text-red-700"
            >
              Demo only — alter entry
            </button>
          </form>
        )}
      </div>
      {verify && (
        <p
          role="status"
          data-testid="verify-result"
          className="mb-4 border p-2"
        >
          {verify.ok
            ? `Ledger OK — ${verify.count} entries, head ${verify.headHash.slice(0, 12)}`
            : `Verification failed at entry ${verify.failedAtSeq} (${verify.reason})`}
          {verify.exportedHead &&
            (verify.exportedHead.matches
              ? ` · Exported head at entry ${verify.exportedHead.seq} matches.`
              : ` · Exported head at entry ${verify.exportedHead.seq} does NOT match.`)}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Actor</th>
            <th>Event</th>
            <th>Hash</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.seq} className="border-t">
              <td>{r.seq}</td>
              <td>{r.ts}</td>
              <td>{r.actorName}</td>
              <td>{r.eventType}</td>
              <td className="font-mono">{r.hashShort}</td>
              <td className="font-mono">{r.payloadPreview}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 flex gap-4">
        {page > 1 && <Link href={`/ledger?page=${page - 1}`}>Newer</Link>}
        {page < pages && <Link href={`/ledger?page=${page + 1}`}>Older</Link>}
      </p>
    </>
  );
}

export default function LedgerPage(props: PageProps<"/ledger">) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Ledger</h1>
      <Suspense fallback={null}>
        <Ledger {...props} />
      </Suspense>
    </main>
  );
}
