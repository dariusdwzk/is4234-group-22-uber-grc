import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sha256Hex } from "@/domain/hash";
import type { Actor } from "@/domain/types";
import {
  actorFromToken,
  createSession,
  SESSION_TTL_MS,
} from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db/client";
import { ledgerEntries, sessions, users } from "@/server/db/schema";
import { loginCommand, performLogin } from "@/server/commands/login";
import { logoutCommand } from "@/server/commands/logout";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { runCommand } from "@/server/run-command";
import { ownerPool, resetTestDb, seedUser } from "./setup/db";

const cookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const PW = "synthetic-test-password";
const EMAIL = "gc@example.test";
let hash: string;
let gc: Actor;

const login = (password: string, email = EMAIL) =>
  runCommand(loginCommand, null, { email, password });
const ledger = () => db.select().from(ledgerEntries).orderBy(ledgerEntries.seq);
const advance = (ms: number) =>
  ownerPool.query("UPDATE demo_settings SET offset_ms = $1 WHERE id = 1", [ms]);

describe("auth", () => {
  beforeAll(async () => {
    hash = await hashPassword(PW);
  });
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
    gc = await seedUser({ email: EMAIL, role: "GC", passwordHash: hash });
    process.env.DEMO_MODE = "true"; // lets tests move the clock
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("login success creates a session that resolves to the actor; DB stores only the token hash", async () => {
    const res = await login(PW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await db.select().from(sessions);
    expect(row!.tokenSha256).toBe(sha256Hex(res.token));
    expect(row!.tokenSha256).not.toBe(res.token);
    expect(row!.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      SESSION_TTL_MS - 60_000,
    );
    expect(await actorFromToken(res.token, new Date())).toEqual(gc);
    expect((await ledger()).at(-1)).toMatchObject({
      eventType: "LOGIN_OK",
      actorId: gc.id,
      payload: { userId: gc.id },
    });
  });

  it("email is matched case-insensitively and trimmed", async () => {
    expect((await login(PW, `  ${EMAIL.toUpperCase()} `)).ok).toBe(true);
  });

  it("unknown token returns null actor; missing token too", async () => {
    expect(await actorFromToken("nope", new Date())).toBeNull();
    expect(await actorFromToken(undefined, new Date())).toBeNull();
  });

  it("expired session returns null actor", async () => {
    const token = await db.transaction((tx) =>
      createSession(tx, gc.id, new Date()),
    );
    expect(await actorFromToken(token, new Date())).toEqual(gc);
    expect(
      await actorFromToken(token, new Date(Date.now() + SESSION_TTL_MS + 1000)),
    ).toBeNull();
  });

  it("wrong password and unknown email both fail generically and are logged without the password", async () => {
    expect(await login("wrong-password-123")).toEqual({ ok: false });
    expect(await login("another-guess-456", "nobody@example.test")).toEqual({
      ok: false,
    });
    const rows = (await ledger()).filter((r) => r.eventType === "LOGIN_FAILED");
    expect(rows.map((r) => r.payload)).toEqual([
      { email: EMAIL },
      { email: "nobody@example.test" },
    ]);
    expect(rows.map((r) => r.actorId)).toEqual([gc.id, null]);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("login ledger payload has no password field", async () => {
    await login("wrong-password-123");
    await login(PW);
    const dump = JSON.stringify(await ledger());
    expect(dump).not.toContain(PW);
    expect(dump).not.toContain("wrong-password-123");
    expect(dump.toLowerCase()).not.toContain("password");
  });

  it("6th attempt within 15 min is locked even with right password", async () => {
    for (let i = 0; i < 5; i++)
      expect((await login(`wrong-guess-${i}`)).ok).toBe(false);
    const [locked] = await db.select().from(users).where(eq(users.id, gc.id));
    expect(locked!.lockedUntil).not.toBeNull();
    expect(await login(PW)).toEqual({ ok: false });
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("the lock lifts after 15 minutes and a success resets the counters", async () => {
    for (let i = 0; i < 5; i++) await login(`wrong-guess-${i}`);
    await advance(14 * 60 * 1000);
    expect((await login(PW)).ok).toBe(false);
    await advance(16 * 60 * 1000);
    expect((await login(PW)).ok).toBe(true);
    const [u] = await db.select().from(users).where(eq(users.id, gc.id));
    expect(u).toMatchObject({ failedLogins: 0, lockedUntil: null });
  });

  it("failures before the lock do not carry over after a success", async () => {
    for (let i = 0; i < 4; i++) await login(`wrong-guess-${i}`);
    expect((await login(PW)).ok).toBe(true);
    for (let i = 0; i < 4; i++) await login(`wrong-again-${i}`);
    expect((await login(PW)).ok).toBe(true);
  });

  it("logout deletes the actor's own session and logs LOGOUT; other sessions survive", async () => {
    const a = await login(PW);
    const b = await login(PW);
    if (!a.ok || !b.ok) throw new Error("login failed");
    await runCommand(logoutCommand, gc, { token: a.token });
    expect(await actorFromToken(a.token, new Date())).toBeNull();
    expect(await actorFromToken(b.token, new Date())).toEqual(gc);
    expect((await ledger()).at(-1)).toMatchObject({
      eventType: "LOGOUT",
      actorId: gc.id,
    });
  });

  it("logout cannot end another user's session", async () => {
    const other = await seedUser({
      email: "pco@example.test",
      role: "PCO",
      passwordHash: hash,
    });
    const res = await login(PW);
    if (!res.ok) throw new Error("login failed");
    await runCommand(logoutCommand, other, { token: res.token });
    expect(await actorFromToken(res.token, new Date())).toEqual(gc);
  });

  it("logout requires a signed-in actor", async () => {
    await expect(
      runCommand(logoutCommand, null, { token: "x" }),
    ).rejects.toThrow(/not signed in/);
  });

  it("performLogin sets an httpOnly Secure SameSite=Lax __Host- cookie only on success", async () => {
    expect(
      await performLogin({ email: EMAIL, password: "wrong-password-123" }),
    ).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(await performLogin({ email: EMAIL, password: PW })).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "__Host-session",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("the ledger stays verifiable after logins, failures and lockouts", async () => {
    for (let i = 0; i < 6; i++) await login(`wrong-guess-${i}`);
    expect(await verifyChain()).toMatchObject({ ok: true });
  });
});
