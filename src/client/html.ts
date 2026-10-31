// Small helpers shared by every view (mockup: helpers and icons).

export const esc = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export const CHK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.2 11.6 2.8 8.2l1.1-1.1 2.3 2.3 5.9-5.9 1.1 1.1z"/></svg>';
export const CRS =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="m4.3 3.2 3.7 3.7 3.7-3.7 1.1 1.1L9.1 8l3.7 3.7-1.1 1.1L8 9.1l-3.7 3.7-1.1-1.1L6.9 8 3.2 4.3z"/></svg>';

/** Value of a checkbox or field the current view rendered. */
export const ck = (id: string): boolean =>
  !!(document.getElementById(id) as HTMLInputElement | null)?.checked;
export const val = (id: string): string =>
  (
    (document.getElementById(id) as HTMLInputElement | null)?.value ?? ""
  ).trim();

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(m: string): void {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 4200);
}
