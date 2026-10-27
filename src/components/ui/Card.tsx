import type { ReactNode } from "react";

export function Card({
  title,
  titleId,
  as,
  className = "",
  children,
}: {
  title?: string;
  titleId?: string;
  as?: "section" | "div";
  className?: string;
  children: ReactNode;
}) {
  const Tag = titleId ? "section" : (as ?? "div");
  return (
    <Tag
      aria-labelledby={titleId}
      className={`rounded-xl border border-line bg-surface p-6 shadow-sm ${className}`}
    >
      {title && (
        <h2 id={titleId} className="mb-4 text-base font-semibold text-ink">
          {title}
        </h2>
      )}
      {children}
    </Tag>
  );
}
