import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-neutral-soft px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
