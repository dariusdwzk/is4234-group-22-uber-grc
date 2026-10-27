import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconMenu } from "@/components/ui/icons";
import type { Actor } from "@/domain/types";
import { SidebarLinks } from "./SidebarLinks";

export function Topbar({
  actor,
  links,
}: {
  actor: Actor;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="relative flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
      <details className="md:hidden">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-field px-3 text-sm font-medium">
          <IconMenu />
          Menu
        </summary>
        <nav
          aria-label="Main"
          className="absolute inset-x-0 top-full z-10 border-b border-line bg-surface p-3 shadow-md"
        >
          <SidebarLinks links={links} />
        </nav>
      </details>
      <span className="ml-auto text-sm">{actor.displayName}</span>
      <Badge variant="neutral">{actor.role}</Badge>
      <form action="/logout" method="post">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </header>
  );
}
