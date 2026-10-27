import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons";

const tones = {
  error: { cls: "bg-danger-soft text-danger-ink border-danger-ink", icon: <IconAlert />, role: "alert" },
  success: { cls: "bg-ok-soft text-ok-ink border-ok-ink", icon: <IconCheck />, role: "status" },
  info: { cls: "bg-info-soft text-info-ink border-info-ink", icon: <IconInfo />, role: "status" },
} as const;

export function Alert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const t = tones[tone];
  return (
    <div role={t.role} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${t.cls}`}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div>{children}</div>
    </div>
  );
}
