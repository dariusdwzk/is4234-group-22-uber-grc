import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Td, Th } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { statusBadge, tierBadge } from "@/components/ui/status";
import { requireActor } from "@/server/page-guard";
import { listCases } from "@/server/queries/cases";

async function CaseList() {
  const actor = await requireActor("viewCases");
  const items = await listCases(actor);
  if (items.length === 0) return <EmptyState>No cases yet.</EmptyState>;
  return (
    <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
      <DataTable>
        <thead>
          <tr>
            <Th>Case</Th>
            <Th>Tier</Th>
            <Th>Status</Th>
            <Th>Source</Th>
            <Th>Detected</Th>
            <Th>Rules</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const tb = tierBadge(c.tier);
            const sb = statusBadge(c.status);
            return (
              <tr key={c.id}>
                <Td>
                  <Link
                    href={`/cases/${c.id}`}
                    className="font-medium text-brand underline"
                  >
                    {c.ref}
                  </Link>
                </Td>
                <Td>
                  <Badge variant={tb.variant}>{tb.label}</Badge>
                </Td>
                <Td>
                  <Badge variant={sb.variant}>{c.status}</Badge>
                </Td>
                <Td>{c.source}</Td>
                <Td>{c.detectedAt}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {c.firedRuleIds.map((r) => (
                      <code
                        key={r}
                        className="rounded bg-neutral-soft px-1.5 py-0.5 font-mono text-xs text-neutral-ink"
                      >
                        {r}
                      </code>
                    ))}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}

export default function CasesPage() {
  return (
    <main className="p-6 lg:p-8">
      <PageHeader title="Cases" />
      <Suspense fallback={null}>
        <CaseList />
      </Suspense>
    </main>
  );
}
