import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { getActor } from "@/server/auth/actor";

// Cookie reads must sit behind Suspense with cacheComponents on. Pages enforce their own authz.
async function Shell({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  return (
    <>
      {actor && <Nav actor={actor} />}
      {children}
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
