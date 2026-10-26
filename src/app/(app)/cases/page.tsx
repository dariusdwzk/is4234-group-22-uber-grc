import Link from "next/link";
import { Suspense } from "react";
import { requireActor } from "@/server/page-guard";
import { listCases } from "@/server/queries/cases";

async function CaseList() {
  const actor = await requireActor("viewCases");
  const items = await listCases(actor);
  if (items.length === 0) return <p>No cases yet.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th>Case</th>
          <th>Tier</th>
          <th>Status</th>
          <th>Source</th>
          <th>Detected</th>
          <th>Rules</th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <tr key={c.id}>
            <td>
              <Link href={`/cases/${c.id}`} className="underline">
                {c.ref}
              </Link>
            </td>
            <td>{c.tier}</td>
            <td>{c.status}</td>
            <td>{c.source}</td>
            <td>{c.detectedAt}</td>
            <td>{c.firedRuleIds.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CasesPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Cases</h1>
      <Suspense fallback={null}>
        <CaseList />
      </Suspense>
    </main>
  );
}
