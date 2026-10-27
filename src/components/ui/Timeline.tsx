import type { ReactNode } from "react";

export function Timeline({ items }: { items: { id: string; title: ReactNode; meta?: ReactNode }[] }) {
  return (
    <ol className="flex flex-col border-l border-line">
      {items.map((it) => (
        <li key={it.id} className="relative pb-4 pl-5 last:pb-0">
          <span aria-hidden="true" className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-field" />
          <div className="text-sm text-ink">{it.title}</div>
          {it.meta && <div className="text-xs text-muted">{it.meta}</div>}
        </li>
      ))}
    </ol>
  );
}
