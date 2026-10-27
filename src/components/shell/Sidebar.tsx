import { SidebarLinks } from "./SidebarLinks";

export function Sidebar({ links }: { links: { href: string; label: string }[] }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 bg-sidebar p-4 md:flex">
      <p className="px-3 text-sm font-semibold text-sidebar-ink">
        Uber 2016 GRC prototype
      </p>
      <nav aria-label="Main">
        <SidebarLinks links={links} dark />
      </nav>
    </aside>
  );
}
