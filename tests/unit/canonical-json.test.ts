import { describe, expect, it } from "vitest";
import { CanonicalJsonError, canonicalJson } from "@/domain/canonical-json";

describe("canonicalJson", () => {
  it("sorts keys and uses no whitespace", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"] })).toBe(
      '{"a":[true,null,"x"],"b":1}',
    );
  });

  it("is independent of key insertion order at every depth", () => {
    expect(canonicalJson({ a: { d: 1, c: 2 } })).toBe(
      canonicalJson({ a: { c: 2, d: 1 } }),
    );
  });

  it("keeps unicode characters unescaped", () => {
    expect(canonicalJson({ name: "Zoë" })).toBe('{"name":"Zoë"}');
  });

  it("sorts keys by UTF-16 code unit, not locale", () => {
    // "B" (0x42) < "a" (0x61) < "é" (0xe9); a locale sort would put "a" first.
    expect(canonicalJson({ é: 1, a: 2, B: 3 })).toBe('{"B":3,"a":2,"é":1}');
  });

  it("escapes strings as JSON", () => {
    expect(canonicalJson({ s: 'a"b\\c\n' })).toBe('{"s":"a\\"b\\\\c\\n"}');
  });

  it("serialises negative zero as 0 and keeps safe integers", () => {
    expect(canonicalJson({ z: -0, n: -5, m: Number.MAX_SAFE_INTEGER })).toBe(
      `{"m":${Number.MAX_SAFE_INTEGER},"n":-5,"z":0}`,
    );
  });

  it("accepts null-prototype objects", () => {
    expect(canonicalJson(Object.assign(Object.create(null), { a: 1 }))).toBe(
      '{"a":1}',
    );
  });

  it.each([
    ["float", 1.5],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["undefined", undefined],
    ["Date", new Date()],
    ["bigint", BigInt(10)],
    ["function", () => 1],
    ["symbol", Symbol("s")],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s", (_name, bad) => {
    expect(() => canonicalJson({ v: bad })).toThrow(CanonicalJsonError);
  });

  it("rejects non-plain objects", () => {
    expect(() => canonicalJson(Object.create({ inherited: 1 }))).toThrow(
      CanonicalJsonError,
    );
    expect(() => canonicalJson(new Map())).toThrow(CanonicalJsonError);
  });

  it("rejects cycles", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => canonicalJson(a)).toThrow(CanonicalJsonError);
  });

  it("rejects undefined array members and lone surrogates", () => {
    expect(() => canonicalJson([undefined])).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ s: "\ud800" })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ s: "a\u0000b" })).toThrow(CanonicalJsonError);
  });
});
