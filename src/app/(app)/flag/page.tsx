import { Suspense } from "react";
import { authorize } from "@/server/authz";
import { requireActor } from "@/server/page-guard";
import { getBoardFlags } from "@/server/queries/flags";
import { resolveFlagAction } from "../board/actions";
import { raiseFlagAction } from "./actions";

async function Flag({ searchParams }: PageProps<"/flag">) {
  const actor = await requireActor("raiseFlag");
  const sp = await searchParams;
  const flags = authorize(actor, "resolveFlag").ok
    ? await getBoardFlags(actor)
    : null;
  return (
    <>
      {sp.recorded === "1" && <p role="status">Flag recorded for review.</p>}
      {sp.error !== undefined && (
        <p role="alert">Please enter a case reference and 5–2000 characters.</p>
      )}
      <form action={raiseFlagAction} className="flex max-w-xl flex-col gap-3">
        <label className="flex flex-col gap-1">
          Case reference
          <input
            name="caseRef"
            required
            maxLength={40}
            className="border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          What concerns you?
          <textarea
            name="text"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            className="border px-2 py-1"
          />
        </label>
        <button type="submit" className="border px-3 py-1">
          Raise flag
        </button>
      </form>
      {flags && (
        <section aria-labelledby="open" className="mt-8">
          <h2 id="open" className="font-semibold">
            Open flags
          </h2>
          <ul>
            {flags.map((f) => (
              <li key={f.id} className="border-t py-2">
                {f.ref} — {f.text}
                <form action={resolveFlagAction} className="mt-1 flex gap-2">
                  <input type="hidden" name="flagId" value={f.id} />
                  <label>
                    Resolution
                    <input
                      name="resolution"
                      required
                      minLength={5}
                      maxLength={2000}
                      className="ml-2 border px-1"
                    />
                  </label>
                  <button type="submit" className="border px-3">
                    Resolve flag
                  </button>
                </form>
              </li>
            ))}
            {flags.length === 0 && <li>None.</li>}
          </ul>
        </section>
      )}
    </>
  );
}

export default function FlagPage(props: PageProps<"/flag">) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Raise a challenge flag</h1>
      <Suspense fallback={null}>
        <Flag {...props} />
      </Suspense>
    </main>
  );
}
