import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROLES } from "@/domain/roles";
import type { Actor, RoleKey } from "@/domain/types";
import { db } from "@/server/db/client";
import { boardNotices, cases, payments } from "@/server/db/schema";
import { acknowledgeNotice } from "@/server/commands/acknowledge-notice";
import { attachContact } from "@/server/commands/attach-contact";
import { attemptAction } from "@/server/commands/attempt-action";
import { disclose } from "@/server/commands/disclose";
import { checkReceipt, reportIncident } from "@/server/commands/employee";
import { declareIncident } from "@/server/commands/declare-incident";
import { jumpToDay24 } from "@/server/commands/jump-to-day24";
import { recommend } from "@/server/commands/recommend";
import { recordFinding } from "@/server/commands/record-finding";
import { releasePayment } from "@/server/commands/release-payment";
import { resetDemo } from "@/server/commands/reset-demo";
import { castVote } from "@/server/commands/vote";
import { Forbidden, ValidationError } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { getViewState } from "@/server/queries/state";

const as = (role: RoleKey): Actor => ({ role, name: ROLES[role].name });
const ALL_NO = {
  data: "NO",
  money: "NO",
  harm: "NO",
  handling: "NO",
  systems: "NO",
  outsiders: "NO",
  ongoing: "NO",
} as const;
const vote = (role: "gc" | "cpo", v: "approve" | "reject") =>
  castVote(as(role), {
    caseId: "C-104",
    vote: v,
    reason: v === "approve" ? "Facts support it" : "Facts contradict it",
    checklist: true,
  });

async function caseC104() {
  return (await db.select().from(cases)).find((c) => c.id === "C-104")!;
}
async function pay2() {
  return (await db.select().from(payments)).find((p) => p.id === "PAY-2");
}
async function ledgerActions(): Promise<string[]> {
  return (await getViewState(as("board"))).ledger.map((e) => e.action);
}

/** Guided tour steps 1-4: finding, email, recommendation, blocked close, Day 24, blocked release. */
async function playUntilApprovals(): Promise<void> {
  await recordFinding(as("security"), {
    caseId: "C-104",
    text: "Confirmed: 16 objects copied.",
  });
  await attachContact(as("cso"), {
    caseId: "C-104",
    text: "We have your rider data.",
  });
  await recommend(as("cso"), {
    caseId: "C-104",
    action: "escalate",
    reason: "Treat it as a bug bounty and keep it in-house.",
  });
  await expect(
    attemptAction(as("cso"), { caseId: "C-104", action: "close" }),
  ).rejects.toThrow("Security cannot close cases.");
  await jumpToDay24(null, {});
  await expect(
    releasePayment(as("finance"), { paymentId: "PAY-2" }),
  ).rejects.toThrow(/stay frozen/);
}

describe("the guided tour, end to end on the server", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetDemo();
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("Day 0: the mass download opens C-104 by itself, HIGH, clocks running, board told", async () => {
    const c = await caseC104();
    expect(c).toMatchObject({
      title: "Mass download of rider and driver data",
      severity: "HIGH",
      status: "Open",
      clocksStartH: 0,
    });
    const notices = await db.select().from(boardNotices);
    expect(notices).toMatchObject([{ id: "N-1", caseId: "C-104", tier: 1 }]);
    expect(notices[0]!.body).toBe(
      "New high-risk incident C-104: mass download of rider and driver data. About 57 million records affected. FTC inquiry still open. GDPR deadline Thu 19 Nov, 09:00.",
    );
    expect((await ledgerActions()).slice(-6)).toEqual([
      "Classified LOW",
      "Signal received",
      "Case opened automatically",
      "Classified HIGH",
      "Deadlines started",
      "Board notice sent (Tier 1)",
    ]);
  });

  it("Day 24: the report and the payment request merge into C-104; the payment is held", async () => {
    await jumpToDay24(null, {});
    const s = await getViewState(as("security"));
    expect(s.clockH).toBe(576);
    const c = s.cases.find((x) => x.id === "C-104")!;
    expect(c.signals).toEqual(["SIG-201", "SIG-202", "SIG-203"]);
    expect(c.rules.filter((r) => r.fired).map((r) => r.id)).toEqual([
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
      "R8",
    ]);
    expect(await pay2()).toMatchObject({
      status: "Held",
      amountCents: 10_000_000,
    });
    // The GDPR window passed during the jump: the board is told before the signals land.
    const notices = await db.select().from(boardNotices);
    expect(notices.map((n) => [n.id, n.kind])).toEqual([
      ["N-1", "t1"],
      ["N-2", "deadline"],
    ]);
    await expect(jumpToDay24(null, {})).rejects.toThrow(/already arrived/);
  });

  it("Ending A: the CPO rejects; disclosure required, PAY-2 cancelled, Tier 2 notice", async () => {
    await playUntilApprovals();
    await vote("gc", "approve");
    expect((await caseC104()).status).toBe("Awaiting Chief Privacy Officer");
    await vote("cpo", "reject");

    expect((await caseC104()).status).toBe("Disclosure required");
    expect((await pay2())!.status).toBe("Cancelled");
    const rejected = (await db.select().from(boardNotices)).find(
      (n) => n.kind === "rejected",
    )!;
    expect(rejected).toMatchObject({ tier: 2 });
    expect(rejected.body).toBe(
      "Chief Privacy Officer rejected the recommendation on C-104. Payment cancelled. Disclosure is required.",
    );

    await disclose(as("gc"), { caseId: "C-104" });
    expect((await caseC104()).status).toBe("Disclosed");
    expect(await verifyChain()).toMatchObject({ ok: true, anchorsOk: true });
  });

  it("Ending B: both approve escalating internally; PAY-2 stays held, Tier 2 notice, disclosure still possible", async () => {
    await playUntilApprovals();
    await vote("gc", "approve");
    await vote("cpo", "approve");

    expect((await caseC104()).status).toBe("Under internal investigation");
    expect((await pay2())!.status).toBe("Held");
    const notice = (await db.select().from(boardNotices)).find(
      (n) => n.kind === "escalated",
    )!;
    expect(notice).toMatchObject({ tier: 2 });
    expect(notice.body).toBe(
      "General Counsel and Chief Privacy Officer agreed to escalate C-104 internally for further investigation. Disclosure has not been made.",
    );
    // Escalating never approves a payment.
    await expect(
      releasePayment(as("finance"), { paymentId: "PAY-2" }),
    ).rejects.toThrow(Forbidden);
    await disclose(as("cpo"), { caseId: "C-104" });
    expect((await caseC104()).status).toBe("Disclosed");
    expect(await verifyChain()).toMatchObject({ ok: true, anchorsOk: true });
  });

  it("escalating needs a reason; disclosing does not", async () => {
    await expect(
      recommend(as("cso"), { caseId: "C-104", action: "escalate" }),
    ).rejects.toThrow(ValidationError);
    await recommend(as("cso"), { caseId: "C-104", action: "disclose" });
    expect((await caseC104()).status).toBe("Awaiting decision");
  });

  it("refusals are 403s and each writes a Blocked entry with the reason", async () => {
    await playUntilApprovals();
    const board = await getViewState(as("board"));
    const blocked = board.ledger.filter((e) => e.action.startsWith("Blocked"));
    expect(blocked.map((e) => [e.actor, e.action, e.detail])).toEqual([
      [
        "CSO (also Deputy GC)",
        "Blocked: Close case",
        "Security cannot close cases.",
      ],
      [
        "Finance",
        "Blocked: Release payment",
        "US$100,000 to jdough (unverified). Linked to C-104, an open high-risk case. Payments on high-risk cases stay frozen; no decision on the case releases them.",
      ],
    ]);
    await expect(
      attemptAction(as("cso"), { caseId: "C-104", action: "approve" }),
    ).rejects.toThrow(/reporting line is Security/);
    await expect(castVote(as("cso"), {})).rejects.toThrow(ValidationError);
    await expect(
      castVote(as("cso"), {
        caseId: "C-104",
        vote: "approve",
        reason: "Facts support it",
        checklist: true,
      }),
    ).rejects.toThrow(Forbidden);
    expect(await verifyChain()).toMatchObject({ ok: true });
  });

  it("an unticked checklist is refused, and one person cannot vote twice", async () => {
    await playUntilApprovals();
    await expect(
      castVote(as("gc"), {
        caseId: "C-104",
        vote: "approve",
        reason: "Facts support it",
        checklist: false,
      }),
    ).rejects.toThrow(ValidationError);
    await vote("gc", "approve");
    await expect(vote("gc", "approve")).rejects.toThrow(/already voted/);
  });

  it("the board can only acknowledge; every other action is refused and logged", async () => {
    const board = as("board");
    await acknowledgeNotice(board, { noticeId: "N-1" });
    const attempts = [
      () => recordFinding(board, { caseId: "C-104", text: "x" }),
      () =>
        recommend(board, {
          caseId: "C-104",
          action: "disclose",
        }),
      () =>
        castVote(board, {
          caseId: "C-104",
          vote: "approve",
          reason: "Facts support it",
          checklist: true,
        }),
      () => disclose(board, { caseId: "C-104" }),
      () => releasePayment(board, { paymentId: "PAY-1" }),
      () => declareIncident(board, { text: "x" }),
      () =>
        reportIncident(board, { text: "x", anonymous: true, answers: ALL_NO }),
    ];
    for (const attempt of attempts)
      await expect(attempt()).rejects.toThrow(Forbidden);
    const actions = await ledgerActions();
    expect(actions.filter((a) => a.startsWith("Blocked")).length).toBe(
      attempts.length,
    );
    expect(actions).toContain("Notice acknowledged");
  });

  it("employees report anonymously and follow up by receipt code", async () => {
    const emp = as("employee");
    const { code } = (await reportIncident(emp, {
      text: "Odd login",
      anonymous: true,
      answers: ALL_NO,
    })) as { code: string };
    expect(code).toMatch(/^RC-[0-9A-Z]{4}$/);
    expect(await checkReceipt(emp, { code })).toMatchObject({
      message: "Case C-105: Awaiting review.",
    });
    const board = await getViewState(as("board"));
    expect(
      board.ledger.filter((e) => e.action === "Staff report received")[0]!
        .actor,
    ).toBe("Anonymous employee");
    // Employees cannot see the case list.
    expect((await getViewState(emp)).cases).toEqual([]);
  });

  it("a declared incident opens its own case and is logged as LOW", async () => {
    const { caseId } = await declareIncident(as("security"), {
      text: "Laptop lost",
    });
    expect(caseId).toBe("C-105");
    const c = (await db.select().from(cases)).find((x) => x.id === caseId)!;
    expect(c).toMatchObject({
      severity: "LOW",
      status: "Logged",
      title: "Laptop lost",
    });
  });

  it("state is filtered by role on the server", async () => {
    const fin = await getViewState(as("finance"));
    expect(fin.cases).toEqual([]);
    expect(fin.payments.map((p) => p.id)).toEqual(["PAY-1"]);
    expect(fin.ledger).toEqual([]);
    const none = await getViewState(null);
    expect([none.cases, none.payments, none.notices, none.ledger]).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });
});
