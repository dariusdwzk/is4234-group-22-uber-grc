import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Answers } from "@/domain/questionnaire";
import { ROLES } from "@/domain/roles";
import type { Actor, RoleKey } from "@/domain/types";
import { db } from "@/server/db/client";
import { boardNotices, cases, evidence } from "@/server/db/schema";
import { addEvidence } from "@/server/commands/add-evidence";
import { reportIncident } from "@/server/commands/employee";
import { recommend } from "@/server/commands/recommend";
import { recordFinding } from "@/server/commands/record-finding";
import { resetDemo } from "@/server/commands/reset-demo";
import { castVote } from "@/server/commands/vote";
import { Forbidden, ValidationError } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { downloadEvidence } from "@/server/queries/evidence";
import { getViewState } from "@/server/queries/state";

const as = (role: RoleKey): Actor => ({ role, name: ROLES[role].name });
const NO: Answers = {
  data: "NO",
  money: "NO",
  harm: "NO",
  handling: "YES",
  systems: "NO",
  outsiders: "NO",
  ongoing: "NO",
};
const NO_CLAIMS = { noData: false, verified: false, routine: false };
const TEXT = Buffer.from(
  "CSO to Security: call it a bug bounty, keep it quiet.",
);
const vote = (role: "gc" | "cpo", v: "approve" | "reject") =>
  castVote(as(role), {
    caseId: "C-105",
    vote: v,
    reason: "Facts support it",
    checklist: true,
  });
const status = async () =>
  (await db.select().from(cases)).find((c) => c.id === "C-105")!.status;
const boardLog = async () =>
  (await getViewState(as("board"))).ledger.filter((e) => e.caseId === "C-105");

describe("independent path: GC and CPO investigate, the other one decides", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetDemo();
    await reportIncident(as("employee"), {
      text: "The CSO is calling a breach a bug bounty",
      anonymous: true,
      answers: NO,
    });
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("the GC records a finding and evidence (with an optional file); the ledger holds its hash", async () => {
    await recordFinding(as("gc"), {
      caseId: "C-105",
      text: "The CSO asked for silence.",
    });
    await addEvidence(as("gc"), {
      caseId: "C-105",
      note: "Chat export from a staff member.",
    });
    await addEvidence(as("cpo"), {
      caseId: "C-105",
      note: "Message the CSO sent.",
      file: {
        name: "msg.txt",
        type: "text/plain",
        base64: TEXT.toString("base64"),
      },
    });
    const rows = await db.select().from(evidence);
    expect(rows.map((r) => [r.authorRole, r.fileName])).toEqual([
      ["gc", null],
      ["cpo", "msg.txt"],
    ]);
    const entry = (await boardLog()).find((e) => e.detail.includes("msg.txt"))!;
    expect(entry.action).toBe("Evidence added");
    expect(entry.detail).toContain(rows[1]!.fileSha256!);

    const gcView = (await getViewState(as("gc"))).cases.find(
      (c) => c.id === "C-105",
    )!;
    expect(gcView.evidence).toHaveLength(2);
    expect(gcView.evidence[1]!.file).toMatchObject({
      name: "msg.txt",
      size: TEXT.length,
    });
    expect(JSON.stringify(gcView)).not.toContain(TEXT.toString("base64")); // bytes never in state

    const file = await downloadEvidence(as("board"), rows[1]!.id);
    expect(file.data.equals(TEXT)).toBe(true);
  });

  it("Security cannot download the evidence or see the case; the attempt is logged", async () => {
    await addEvidence(as("gc"), {
      caseId: "C-105",
      note: "Message",
      file: {
        name: "m.txt",
        type: "text/plain",
        base64: TEXT.toString("base64"),
      },
    });
    const [row] = await db.select().from(evidence);
    await expect(downloadEvidence(as("security"), row!.id)).rejects.toThrow(
      Forbidden,
    );
    await expect(
      addEvidence(as("security"), { caseId: "C-105", note: "x" }),
    ).rejects.toThrow(Forbidden);
    expect((await boardLog()).map((e) => e.action)).toEqual(
      expect.arrayContaining([
        "Blocked: Download evidence",
        "Blocked: Add evidence",
      ]),
    );
  });

  it("bad files are refused with a reason the user can act on", async () => {
    const err = await addEvidence(as("gc"), {
      caseId: "C-105",
      note: "Page",
      file: {
        name: "x.html",
        type: "text/html",
        base64: TEXT.toString("base64"),
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).userMessage).toMatch(/Only PDF/);
    expect(await db.select().from(evidence)).toHaveLength(0);
  });

  it("the GC recommends limiting; the GC cannot approve it; the CPO approves → disclosure limited, board told", async () => {
    await recommend(as("gc"), {
      caseId: "C-105",
      action: "limit",
      claims: NO_CLAIMS,
      reason: "No customer data involved.",
    });
    expect(await status()).toBe("Awaiting Chief Privacy Officer");
    await expect(vote("gc", "approve")).rejects.toThrow(
      "You recommended this, so the Chief Privacy Officer must decide.",
    );
    expect((await boardLog()).map((e) => e.action)).toContain(
      "Blocked: Approve",
    );

    await vote("cpo", "approve");
    expect(await status()).toBe("Disclosure limited");
    const limited = (await db.select().from(boardNotices)).find(
      (n) => n.caseId === "C-105" && n.kind === "limited",
    )!;
    expect(limited).toMatchObject({ tier: 2 });
    expect(limited.body).toBe(
      "General Counsel and Chief Privacy Officer agreed to limit disclosure on C-105. The decision is permanently on record.",
    );
    expect(await verifyChain()).toMatchObject({ ok: true, anchorsOk: true });
  });

  it("the CPO recommends disclosure; the GC rejects → disclosure required, board told", async () => {
    await recommend(as("cpo"), {
      caseId: "C-105",
      action: "disclose",
      claims: NO_CLAIMS,
    });
    expect(await status()).toBe("Awaiting General Counsel");
    await vote("gc", "reject");
    expect(await status()).toBe("Disclosure required");
    expect(
      (await db.select().from(boardNotices)).find((n) => n.kind === "rejected")!
        .body,
    ).toBe(
      "General Counsel rejected the recommendation on C-105. Disclosure is required.",
    );
  });

  it("a disclose recommendation approved by the other one is disclosed", async () => {
    await recommend(as("gc"), {
      caseId: "C-105",
      action: "disclose",
      claims: NO_CLAIMS,
    });
    await vote("cpo", "approve");
    expect(await status()).toBe("Disclosed");
  });

  it("on the normal path GC and CPO decide but do not investigate or recommend", async () => {
    await expect(
      recordFinding(as("gc"), { caseId: "C-104", text: "x" }),
    ).rejects.toThrow(
      "On the normal path Security investigates and the CSO recommends. You decide.",
    );
    await expect(
      recommend(as("cpo"), {
        caseId: "C-104",
        action: "disclose",
        claims: NO_CLAIMS,
      }),
    ).rejects.toThrow(Forbidden);
    await expect(
      addEvidence(as("gc"), { caseId: "C-104", note: "x" }),
    ).rejects.toThrow(Forbidden);
  });
});
