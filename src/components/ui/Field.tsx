import type { ReactNode } from "react";
import { useId } from "react";

export const controlClass =
  "w-full min-h-10 rounded-lg border border-field bg-surface px-3 py-2 text-sm text-ink";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-danger-ink">{error}</p>}
    </div>
  );
}
