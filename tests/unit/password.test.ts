import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("hash/verify round trip, with the documented format", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).toMatch(
      /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    );
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("wrong password false", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("battery staple", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts: the same password hashes differently each time", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });

  it("malformed stored false", async () => {
    for (const bad of [
      "",
      "plaintext",
      "scrypt$1$2$3",
      "bcrypt$32768$8$1$c2FsdA==$aGFzaA==",
      "scrypt$notanumber$8$1$c2FsdA==$aGFzaA==",
      "scrypt$32767$8$1$c2FsdA==$aGFzaA==", // N not a power of two
      "scrypt$1073741824$8$1$c2FsdA==$aGFzaA==", // N far above the allowed bound
      "scrypt$32768$8$1$$aGFzaA==",
      "scrypt$32768$8$1$c2FsdA==$",
    ]) {
      expect(await verifyPassword("pw", bad), bad).toBe(false);
    }
  });
});
