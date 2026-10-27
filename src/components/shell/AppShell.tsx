import { navLinks } from "@/domain/nav";
import type { Actor } from "@/domain/types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// Pages render their own <main>; #main here is only the skip-link target.
export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const links = navLinks(actor.role);
  return (
    <div className="flex min-h-screen flex-1">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>
      <Sidebar links={links} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar actor={actor} links={links} />
        <div id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
