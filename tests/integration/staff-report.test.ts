import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Answers } from "@/domain/questionnaire";
import { ROLES } from "@/domain/roles";
import type { Actor, RoleKey } from "@/domain/types";
import { db } from "@/server/db/client";
import { boardNotices, cases } from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { attemptAction } from "@/server/commands/attempt-action";
import { confirmTriage } from "@/server/commands/confirm-triage";
import { checkReceipt, reportIncident } from "@/server/commands/employee";
import { recordFinding } from "@/server/commands/record-finding";
import { resetDemo } from "@/server/commands/reset-demo";
import { Forbidden } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { getViewState } from "@/server/queries/state";

const as = (role: RoleKey): Actor => ({ role, name: ROLES[role].name });
const NO: Answers = {
  data: "NO",
  money: "NO",
  harm: "NO",
  handling: "NO",
  systems: "NO",
  outsiders: "NO",
  ongoing: "NO",
};

async function report(text: string, answers: Partial<Answers>) {
  const r = (await reportIncident(as("employee"), {
    text,
    anonymous: true,
    answers: { ...NO, ...answers },
  })) as { code: string };
  const c = (await db.select().from(cases)).find((x) => x.id === "C-105")!;
  return { ...r, c };
}
const caseById = async (id = "C-105") =>
  (await db.select().from(cases)).find((x) => x.id === id)!;
const noticesFor = async (id = "C-105") =>
  (await db.select().from(boardNotices)).filter((n) => n.caseId === id);
const actions = async () =>
  (await getViewState(as("board"))).ledger
    .filter((e) => e.caseId === "C-105")
    .map((e) => e.action);

describe("employee incident reports (staff report flow)", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetDemo();
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("1. 2016-style report → HIGH, NORMAL, Tier 1 notice; Security can work it", async () => {
    const { c, code } = await report(
      "Hacker emailed demanding money for rider data",
      {
        data: "YES",
        money: "YES",
        outsiders: "YES",
      },
    );
    expect(c).toMatchObject({
      severity: "HIGH",
      route: "NORMAL",
      status: "Open",
    });
    expect(await noticesFor()).toMatchObject([{ tier: 1 }]);
    expect(await actions()).toEqual([
      "Staff report received",
      "Rated HIGH from questionnaire",
      "Board notice sent (Tier 1)",
    ]);
    expect(await checkReceipt(as("employee"), { code })).toMatchObject({
      message: "Case C-105: Open.",
    });
    expect(
      (await getViewState(as("security"))).cases.map((x) => x.id),
    ).toContain("C-105");
  });

  it("2. CSO calls a breach a bug bounty → HIGH, INDEPENDENT; Security is refused and cannot see it", async () => {
    const { c } = await report("CSO is calling the breach a bug bounty", {
      handling: "YES",
    });
    expect(c).toMatchObject({ severity: "HIGH", route: "INDEPENDENT" });
    expect(await noticesFor()).toMatchObject([{ tier: 1 }]);
    expect(await actions()).toContain(
      "Routed away from Security: concern about how an incident is handled",
    );

    await expect(
      recordFinding(as("security"), { caseId: "C-105", text: "x" }),
    ).rejects.toThrow(Forbidden);
    await expect(
      attemptAction(as("cso"), { caseId: "C-105", action: "close" }),
    ).rejects.toThrow(/independently of Security/);
    const sec = await getViewState(as("security"));
    expect(sec.cases.map((x) => x.id)).not.toContain("C-105");
    expect(sec.ledger.some((e) => e.caseId === "C-105")).toBe(false);
    expect(sec.notices.some((n) => n.caseId === "C-105")).toBe(false);
    expect(sec.signals.some((s) => s.caseId === "C-105")).toBe(false);
    expect((await getViewState(as("gc"))).cases.map((x) => x.id)).toContain(
      "C-105",
    );

    const blocked = (await getViewState(as("board"))).ledger.filter(
      (e) => e.caseId === "C-105" && e.action.startsWith("Blocked"),
    );
    expect(blocked.map((e) => [e.actor, e.action])).toEqual([
      ["Security team", "Blocked: Add finding"],
      ["CSO (also Deputy GC)", "Blocked: Close case"],
    ]);
  });

  it("3. lost laptop, data NOT_SURE → triage; unrated after 24 h → HIGH automatically", async () => {
    const { c } = await report("Lost a laptop with rider data", {
      data: "NOT_SURE",
    });
    expect(c).toMatchObject({
      severity: "PENDING",
      status: "Needs triage",
      triageDueH: 24,
    });
    expect(await noticesFor()).toEqual([]);
    expect(await actions()).toContain(
      "Sent for triage: reporter unsure about impact",
    );

    await advanceClock(null, { hours: 24 });
    expect(await caseById()).toMatchObject({
      severity: "HIGH",
      route: "NORMAL",
      status: "Open",
    });
    expect(await noticesFor()).toMatchObject([{ tier: 1 }]);
    expect(await actions()).toContain(
      "Triage timed out: rated HIGH automatically",
    );
  });

  it("4. lost laptop, the CPO confirms LOW within 24 h → LOW, no board notice", async () => {
    await report("Lost a laptop with rider data", { data: "NOT_SURE" });
    await recordFinding(as("security"), {
      caseId: "C-105",
      text: "Laptop was encrypted and wiped remotely.",
      facts: { dataAccessed: false, moneyConcern: false, harmConcern: false },
    });
    await confirmTriage(as("cpo"), {
      caseId: "C-105",
      rating: "LOW",
      reason: "Full-disk encryption; no data exposed.",
    });
    await advanceClock(null, { hours: 24 });
    expect(await caseById()).toMatchObject({
      severity: "LOW",
      route: "SECURITY_TRIAGE",
    });
    expect(await noticesFor()).toEqual([]);
    expect(await actions()).toContain(
      "Triage rating confirmed by Chief Privacy Officer: LOW",
    );
  });

  it("5. phishing, nobody clicked → LOW, SECURITY_TRIAGE, no notice; unreviewed after 3 business days → Tier 2", async () => {
    const { c } = await report("Phishing email, nobody clicked", {});
    expect(c).toMatchObject({
      severity: "LOW",
      route: "SECURITY_TRIAGE",
      status: "Awaiting review",
      reviewDueH: 72,
    });
    expect(await noticesFor()).toEqual([]);
    await advanceClock(null, { hours: 24 });
    await advanceClock(null, { hours: 24 });
    expect(await noticesFor()).toEqual([]);
    await advanceClock(null, { hours: 24 });
    expect(await noticesFor()).toMatchObject([
      {
        tier: 2,
        kind: "review",
        body: "Low-risk staff report not reviewed in time.",
      },
    ]);
  });

  it("5b. a review by Security in time stops the late notice", async () => {
    await report("Phishing email, nobody clicked", {});
    await recordFinding(as("security"), {
      caseId: "C-105",
      text: "Reported to mail filter.",
    });
    expect((await caseById()).status).toBe("Reviewed");
    for (let i = 0; i < 4; i++) await advanceClock(null, { hours: 24 });
    expect(await noticesFor()).toEqual([]);
  });

  it("6. ransomware locks dispatch → HIGH, NORMAL", async () => {
    const { c } = await report("Ransomware locked dispatch", {
      money: "YES",
      systems: "YES",
      ongoing: "YES",
    });
    expect(c).toMatchObject({ severity: "HIGH", route: "NORMAL" });
  });

  it("7. driver home address shared in a chat group → HIGH, NORMAL", async () => {
    const { c } = await report("Driver address shared in a chat group", {
      data: "YES",
      harm: "YES",
    });
    expect(c).toMatchObject({ severity: "HIGH", route: "NORMAL" });
  });

  it("8. app slow for one hour → LOW, SECURITY_TRIAGE", async () => {
    const { c } = await report("App slow for an hour", { systems: "YES" });
    expect(c).toMatchObject({ severity: "LOW", route: "SECURITY_TRIAGE" });
    expect(await noticesFor()).toEqual([]);
  });

  it("9. Security tries to confirm a triage rating → 403 and a Blocked entry", async () => {
    await report("Lost a laptop with rider data", { data: "NOT_SURE" });
    await expect(
      confirmTriage(as("security"), {
        caseId: "C-105",
        rating: "LOW",
        reason: "fine",
      }),
    ).rejects.toThrow(Forbidden);
    expect((await caseById()).status).toBe("Needs triage");
    expect(await actions()).toContain("Blocked: Confirm rating");
  });

  it("10. handling NOT_SURE is treated as YES → HIGH, INDEPENDENT", async () => {
    const { c } = await report(
      "Not sure the incident is being handled properly",
      {
        handling: "NOT_SURE",
      },
    );
    expect(c).toMatchObject({ severity: "HIGH", route: "INDEPENDENT" });
    expect(await noticesFor()).toMatchObject([{ tier: 1 }]);
  });

  it("an unanswered question is refused; the ledger stays intact through every path", async () => {
    await expect(
      reportIncident(as("employee"), {
        text: "x",
        anonymous: true,
        answers: { data: "YES" },
      }),
    ).rejects.toThrow(/invalid input/);
    await report("Lost a laptop", { data: "NOT_SURE" });
    await advanceClock(null, { hours: 24 });
    expect(await verifyChain()).toMatchObject({ ok: true, anchorsOk: true });
  });
});
