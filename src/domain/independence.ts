/**
 * Approver independence (US-13): nobody in the approver's reporting line, or the approver,
 * may be a CISO. Fails closed on unknown ids, dangling managers and cycles.
 */
export function isIndependent(
  userId: string,
  reportsTo: ReadonlyMap<string, string | null>,
  cisoIds: ReadonlySet<string>,
): boolean {
  if (!reportsTo.has(userId)) return false;
  const seen = new Set<string>();
  let current: string | null = userId;
  while (current !== null) {
    if (cisoIds.has(current) || seen.has(current)) return false;
    seen.add(current);
    if (!reportsTo.has(current)) return false;
    current = reportsTo.get(current) ?? null;
  }
  return true;
}
