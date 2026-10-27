import type { ReactNode } from "react";

export function Card({
  title,
  titleId,
  as,
  tone = "default",
  className = "",
  children,
}: {
  title?: string;
  titleId?: string;
  as?: "section" | "div";
  tone?: "default" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const danger = tone === "danger";
  const Tag = titleId ? "section" : (as ?? "div");
  return (
    <Tag
      aria-labelledby={titleId}
      className={`rounded-xl border p-6 shadow-sm ${danger ? "border-danger-ink bg-danger-soft" : "border-line bg-surface"} ${className}`}
    >
      {title && (
        <h2
          id={titleId}
          className={`mb-4 text-base font-semibold ${danger ? "text-danger-ink" : "text-ink"}`}
        >
          {title}
        </h2>
      )}
      {children}
    </Tag>
  );
}
