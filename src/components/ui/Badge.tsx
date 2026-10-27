import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons";
import type { Variant } from "./status";

const styles: Record<Variant, string> = {
  danger: "bg-danger-soft text-danger-ink",
  warn: "bg-warn-soft text-warn-ink",
  ok: "bg-ok-soft text-ok-ink",
  info: "bg-info-soft text-info-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
};

const icons: Partial<Record<Variant, ReactNode>> = {
  danger: <IconAlert />,
  warn: <IconAlert />,
  ok: <IconCheck />,
  info: <IconInfo />,
};

export function Badge({ variant, children }: { variant: Variant; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {icons[variant]}
      {children}
    </span>
  );
}
