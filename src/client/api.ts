import type { RoleKey } from "@/domain/types";
import type { ViewState } from "@/domain/view-state";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string };

const headers = (role: RoleKey | null): HeadersInit => ({
  "content-type": "application/json",
  ...(role ? { "x-role": role } : {}),
});

/** Everything the role may see; the server filters it. */
export async function fetchState(role: RoleKey | null): Promise<ViewState> {
  const res = await fetch("/api/state", {
    headers: headers(role),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load the demo state.");
  return (await res.json()) as ViewState;
}

/** POST /api/actions/<name> as the current role. Refusals come back as { ok: false }. */
export async function act<T = unknown>(
  role: RoleKey | null,
  name: string,
  body: unknown = {},
): Promise<ApiResult<T>> {
  const res = await fetch("/api/actions/" + name, {
    method: "POST",
    headers: headers(role),
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.ok) return { ok: true, data: json as T };
  return {
    ok: false,
    status: res.status,
    error: json.error ?? "Something went wrong.",
  };
}
