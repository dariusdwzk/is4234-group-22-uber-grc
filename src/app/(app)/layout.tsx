import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { getActor } from "@/server/auth/actor";

// Cookie reads must sit behind Suspense with cacheComponents on. Pages enforce their own authz.
async function Shell({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  return actor ? <AppShell actor={actor}>{children}</AppShell> : <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
