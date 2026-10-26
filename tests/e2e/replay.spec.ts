import { expect, test } from "@playwright/test";
import {
  firePreset,
  loginAs,
  raiseFlag,
  resetDemo,
  tamper,
  verifyLedger,
} from "./fixtures";

test.describe.serial("replay: Uber 2016, steps 1-8", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await resetDemo(page);
    await page.close();
  });

  test("Step 1 (F11): employee declares out-of-band demand; sees receipt only", async ({
    page,
  }) => {
    await loginAs(page, "emp");
    await page.goto("/report");
    await page
      .getByLabel("Description")
      .fill(
        "External party emailed a security lead's personal address claiming to hold rider/driver data and demanding payment.",
      );
    await page.getByLabel("Related reference (optional)").fill("REPLAY-2016");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByRole("status")).toContainText("Thank you — receipt");
    await expect(page.getByRole("status")).toContainText(
      "The case is now with the incident governance process.",
    );
    await expect(page.locator("body")).not.toContainText("CASE-");
    await page.goto("/cases");
    // Streamed under Suspense, so the status is already 200: assert on what renders.
    await expect(page.getByText("could not be found")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cases" })).toHaveCount(0);
  });

  test("Step 2 (F12, F3): alert + bounty + payment merge into the declared case", async ({
    page,
  }) => {
    await firePreset(page, /Cloud download alert/);
    await firePreset(page, /Bug bounty report/);
    await firePreset(page, /Payment request/);
    await loginAs(page, "sa");
    await page.goto("/cases");
    await expect(page.getByRole("link", { name: /CASE-/ })).toHaveCount(1);
    await page.getByRole("link", { name: "CASE-0001" }).click();
    await expect(
      page.getByRole("region", { name: "Events" }).getByRole("listitem"),
    ).toHaveCount(4);
  });

  test("Step 3 (F3–F5, F8): case is HIGH with R-PII, R-PAY-LINKED, R-PAYEE, R-CAP, R-EXTORT and a Tier 1 notice exists", async ({
    page,
  }) => {
    await loginAs(page, "sa");
    await page.goto("/cases");
    await page.getByRole("link", { name: "CASE-0001" }).click();
    await expect(page.getByTestId("tier")).toHaveText("HIGH");
    const rules = page.getByRole("region", { name: "Fired rules" });
    for (const id of ["R-PII", "R-PAY-LINKED", "R-PAYEE", "R-CAP", "R-EXTORT"])
      await expect(rules).toContainText(id);
    const tier1 = page.getByRole("region", { name: "Tier 1 board notice" });
    await expect(tier1).toContainText("CASE-0001");
    await expect(tier1).toContainText("Read-only notice — no action required.");
  });

  test('Step 4 (F1): security recommends "treat as bug bounty", close is refused naming missing approvals', async ({
    page,
  }) => {
    await loginAs(page, "sa");
    await page.goto("/cases");
    await page.getByRole("link", { name: "CASE-0001" }).click();
    await page.getByLabel("Was data taken?").selectOption("no");
    await page.getByLabel("Treat as").selectOption("bug_bounty");
    await page.getByLabel("Proposed outcome").selectOption("withhold");
    await page.getByLabel("Recommendation", { exact: true }).fill("Bounty.");
    await page.getByRole("button", { name: "Record recommendation" }).click();
    await expect(
      page.getByText("Recommendation conflicts with evidence"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close case" }).click();
    await expect(page.getByRole("alert").first()).toContainText(
      "Missing: General Counsel, Privacy/Compliance",
    );
    await expect(page.getByTestId("tier")).toHaveText("HIGH");
    await expect(page.getByTestId("status")).toHaveText("open");
  });

  test("Step 5 (F2): GC and PCO sign withhold with checklist and reason code → case closed; board Tier 1 still present", async ({
    page,
  }) => {
    for (const who of ["gc", "pco"] as const) {
      await loginAs(page, who);
      await page.goto("/cases");
      await page.getByRole("link", { name: "CASE-0001" }).click();
      await page.getByLabel("Withhold").check();
      await page.getByLabel("Reason code").selectOption("LEGAL_ADVICE");
      for (const box of await page
        .getByRole("group", { name: /Checklist/ })
        .getByRole("checkbox")
        .all())
        await box.check();
      await page.getByRole("button", { name: "Submit decision" }).click();
    }
    await expect(page.getByTestId("status")).toHaveText("closed");
    await expect(page.getByTestId("gate-state")).toContainText(
      "Agreed: withhold",
    );
    await expect(
      page.getByRole("region", { name: "Tier 1 board notice" }),
    ).toContainText("CASE-0001");
  });

  test("Step 6 (F6): employee challenge flag escalates to Tier 2", async ({
    page,
  }) => {
    await raiseFlag(page, "CASE-0001", "The case was closed too quickly.");
    await loginAs(page, "acc");
    await page.goto("/board");
    const item = page
      .getByTestId("tier2-item")
      .filter({ hasText: "challenge flag" });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("CASE-0001");
  });

  test("Step 7 (F10): demo tamper makes verify fail at entry N", async ({
    page,
  }) => {
    await loginAs(page, "acc");
    await page.goto("/ledger");
    await verifyLedger(page);
    await expect(page.getByTestId("verify-result")).toContainText("Ledger OK");
    await tamper(page, 4);
    await page.goto("/ledger");
    await verifyLedger(page);
    await expect(page.getByTestId("verify-result")).toContainText(
      "Verification failed at entry 4",
    );
  });

  test("Step 8 (F9): dashboard shows days-to-board vs 371", async ({
    page,
  }) => {
    await loginAs(page, "acc");
    await page.goto("/board");
    await expect(page.getByTestId("kpi-card").first()).toContainText(
      "Detection → board notice",
    );
    await expect(page.getByTestId("kpi-uber")).toContainText(
      "Uber 2016: 371 days to disclosure",
    );
    await expect(page.getByTestId("head-status")).toContainText(
      "Verification failed at entry 4",
    );
  });

  test("Scenario C: low-risk login auto-logged as LOW", async ({ page }) => {
    await firePreset(page, /Scenario C/);
    await loginAs(page, "sa");
    await page.goto("/cases");
    const row = page.getByRole("row", { name: /CASE-0002/ });
    await expect(row).toContainText("LOW");
    await expect(row).toContainText("auto_closed");
  });
});
