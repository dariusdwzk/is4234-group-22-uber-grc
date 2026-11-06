export type OpenCase = { id: string; status: string; entityKeys: string[] };

/**
 * The mockup's ingest(): a new signal joins the first open case whose signals share an
 * entity key with it. Returns that case and the shared key, or null for a new case.
 */
export function matchCase(
  keys: readonly string[],
  cases: readonly OpenCase[],
): { caseId: string; key: string } | null {
  for (const c of cases) {
    if (c.status === "Closed") continue;
    const key = c.entityKeys.find((k) => keys.includes(k));
    if (key) return { caseId: c.id, key };
  }
  return null;
}
