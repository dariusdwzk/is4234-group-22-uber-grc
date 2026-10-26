import Link from "next/link";
import { navLinks } from "@/domain/nav";
import type { Actor } from "@/domain/types";

export function Nav({ actor }: { actor: Actor }) {
  return (
    <nav
      aria-label="Main"
      className="flex items-center gap-4 border-b px-4 py-2 text-sm"
    >
      {navLinks(actor.role).map((l) => (
        <Link key={l.href} href={l.href} className="underline">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto">
        {actor.displayName} ({actor.role})
      </span>
      <form action="/logout" method="post">
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </nav>
  );
}
