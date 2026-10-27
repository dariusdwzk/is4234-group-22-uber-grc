import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Td, Th } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { IconAlert } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
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
      <Card title="Integrity" titleId="integrity" className="mb-6">
        <p className="text-sm text-muted">
          {total} entries. <span data-testid="entry-count">{total}</span>
        </p>
        {typeof sp.error === "string" && (
          <div className="mt-4">
            <Alert tone="error">That action could not be completed.</Alert>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <form method="get">
            <input type="hidden" name="verify" value="1" />
            <SubmitButton>Verify ledger</SubmitButton>
          </form>
          {canExport && (
            <form action={exportAction}>
              <SubmitButton variant="secondary">Export head</SubmitButton>
            </form>
          )}
        </div>
        {verify && (
          <div className="mt-4 flex items-start gap-2">
            {!verify.ok && (
              <span className="flex items-center gap-1 text-sm font-semibold text-danger-ink">
                <span aria-hidden="true">
                  <IconAlert />
                </span>
                Failed
              </span>
            )}
            <p
              role="status"
              data-testid="verify-result"
              className={`min-w-0 flex-1 break-words rounded-lg border p-3 text-sm ${
                verify.ok
                  ? "border-ok-ink bg-ok-soft text-ok-ink"
                  : "border-danger-ink bg-danger-soft text-danger-ink"
              }`}
            >
              {verify.ok
                ? `Ledger OK — ${verify.count} entries, head ${verify.headHash.slice(0, 12)}`
                : `Verification failed at entry ${verify.failedAtSeq} (${verify.reason})`}
              {verify.exportedHead &&
                (verify.exportedHead.matches
                  ? ` · Exported head at entry ${verify.exportedHead.seq} matches.`
                  : ` · Exported head at entry ${verify.exportedHead.seq} does NOT match.`)}
            </p>
          </div>
        )}
      </Card>
      {canTamper && (
        <Card
          title="Demo only"
          titleId="demo-only"
          className="mb-6 border-danger-ink"
        >
          <form action={tamperAction} className="flex flex-wrap items-end gap-3">
            <Field label="Entry number">
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  name="seq"
                  type="number"
                  min={2}
                  required
                  className="min-h-10 w-28 rounded-lg border border-field bg-surface px-3 text-sm text-ink"
                />
              )}
            </Field>
            <SubmitButton variant="danger">Demo only — alter entry</SubmitButton>
          </form>
        </Card>
      )}
      <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
        <DataTable caption="Ledger entries">
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Event</Th>
              <Th>Hash</Th>
              <Th>Payload</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq}>
                <Td>{r.seq}</Td>
                <Td>{r.ts}</Td>
                <Td>{r.actorName}</Td>
                <Td>{r.eventType}</Td>
                <Td className="min-w-0 break-all font-mono text-xs">
                  {r.hashShort}
                </Td>
                <Td className="min-w-0 break-all font-mono text-xs">
                  {r.payloadPreview}
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      <nav aria-label="Ledger pages" className="mt-4 flex gap-3">
        {page > 1 && (
          <Link
            href={`/ledger?page=${page - 1}`}
            className={buttonClass("secondary")}
          >
            Newer
          </Link>
        )}
        {page < pages && (
          <Link
            href={`/ledger?page=${page + 1}`}
            className={buttonClass("secondary")}
          >
            Older
          </Link>
        )}
      </nav>
    </>
  );
}

export default function LedgerPage(props: PageProps<"/ledger">) {
  return (
    <main className="p-6 lg:p-8">
      <PageHeader title="Ledger" />
      <Suspense fallback={null}>
        <Ledger {...props} />
      </Suspense>
    </main>
  );
}
