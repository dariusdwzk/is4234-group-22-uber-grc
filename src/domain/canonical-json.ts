export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function encodeString(s: string, path: string): string {
  // Lone surrogates and NUL do not survive a Postgres jsonb round trip, which would
  // silently break the hash on re-read; refuse them at write time.
  if (!s.isWellFormed())
    throw new CanonicalJsonError(`lone surrogate at ${path}`);
  if (s.includes("\u0000"))
    throw new CanonicalJsonError(`NUL character at ${path}`);
  return JSON.stringify(s);
}

function encode(value: unknown, path: string, seen: Set<object>): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return encodeString(value, path);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalJsonError(`non-integer or unsafe number at ${path}`);
      }
      return String(value === 0 ? 0 : value); // normalises -0
    case "object":
      break;
    default:
      throw new CanonicalJsonError(`unsupported ${typeof value} at ${path}`);
  }

  const obj = value as object;
  if (seen.has(obj)) throw new CanonicalJsonError(`cycle at ${path}`);
  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      return `[${obj.map((v, i) => encode(v, `${path}[${i}]`, seen)).join(",")}]`;
    }
    if (!isPlainObject(obj))
      throw new CanonicalJsonError(`non-plain object at ${path}`);
    const rec = obj as Record<string, unknown>;
    // Default sort compares UTF-16 code units, as the spec requires.
    const parts = Object.keys(rec)
      .sort()
      .map(
        (k) =>
          `${encodeString(k, `${path}.<key>`)}:${encode(rec[k], `${path}.${k}`, seen)}`,
      );
    return `{${parts.join(",")}}`;
  } finally {
    seen.delete(obj);
  }
}

export function canonicalJson(value: unknown): string {
  return encode(value, "$", new Set());
}
