/** Evidence files are optional; when given they must be small and of a plain type. */
export const EVIDENCE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;
export const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024;

export type EvidenceFileMeta = { name: string; type: string; size: number };

/** Why a file is refused, or null if it is acceptable. */
export function fileProblem(f: EvidenceFileMeta): string | null {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(f.type))
    return "Only PDF, PNG, JPEG or plain text files can be attached.";
  if (f.size === 0) return "The file is empty.";
  if (f.size > EVIDENCE_MAX_BYTES) return "Files must be 2 MB or smaller.";
  return null;
}

/** A file name safe to store and to send back in a download header. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[^\w.\- ]/g, "_")
    .trim()
    .slice(0, 100);
  return clean || "evidence";
}
