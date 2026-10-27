"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBoard,
  IconCases,
  IconDemo,
  IconFlag,
  IconLedger,
  IconReport,
} from "@/components/ui/icons";

const ICONS: Record<string, () => React.JSX.Element> = {
  "/cases": IconCases,
  "/report": IconReport,
  "/board": IconBoard,
  "/flag": IconFlag,
  "/ledger": IconLedger,
  "/demo": IconDemo,
};

export function SidebarLinks({
  links,
  dark = false,
}: {
  links: { href: string; label: string }[];
  dark?: boolean;
}) {
  const path = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        const Icon = ICONS[l.href];
        const tone = dark
          ? active
            ? "bg-white/10 text-white"
            : "text-sidebar-ink hover:bg-white/5"
          : active
            ? "bg-info-soft text-info-ink"
            : "text-ink hover:bg-neutral-soft";
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${tone}`}
            >
              {Icon && <Icon />}
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
