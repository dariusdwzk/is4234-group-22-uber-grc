import "server-only";
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;
// Bounds on parameters read back from a stored hash, so a corrupted row cannot demand huge memory.
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;

function scryptAsync(
  pw: string,
  salt: Buffer,
  keylen: number,
  opts: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pw.normalize("NFKC"), salt, keylen, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

const maxmem = (n: number, r: number) => 128 * n * r * 2;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(pw, salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: maxmem(N, R),
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  pw: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(n) || n < 2 || n > MAX_N || (n & (n - 1)) !== 0)
    return false;
  if (!Number.isInteger(r) || r < 1 || r > MAX_R) return false;
  if (!Number.isInteger(p) || p < 1 || p > MAX_P) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const actual = await scryptAsync(pw, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: maxmem(n, r),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
