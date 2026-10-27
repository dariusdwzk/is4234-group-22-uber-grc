import { test } from "@playwright/test";
import { firePreset, loginAs, raiseFlag, resetDemo, tamper } from "./fixtures";

const VIEWPORTS = [
  { dir: "1440", width: 1440, height: 900 },
  { dir: "768", width: 768, height: 1024 },
  { dir: "375", width: 375, height: 812 },
] as const;

type Views = Record<string, { as?: Parameters<typeof loginAs>[1]; path: string }>;
const before: Views = {
  login: { path: "/login" },
  report: { as: "emp", path: "/report" },
  cases: { as: "sa", path: "/cases" },
  "case-detail": { as: "sa", path: "/cases" }, // opens CASE-0001 below
  board: { as: "acc", path: "/board" },
  "ledger-ok": { as: "ia", path: "/ledger?verify=1" },
};
const ready: Record<string, string> = {
  login: "Sign in",
  report: "Report",
  cases: "Cases",
  board: "Board",
  "ledger-ok": "Ledger",
  "ledger-failed": "Ledger",
  flag: "Flag",
  demo: "Demo panel",
};
const afterTamper: Views = {
  "ledger-failed": { as: "ia", path: "/ledger?verify=1" },
  flag: { as: "emp", path: "/flag" },
  demo: { as: "demo", path: "/demo" },
};

test.describe.serial("screenshots", () => {
  test.skip(process.env.SCREENSHOTS !== "1", "set SCREENSHOTS=1 to capture");

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await resetDemo(page);
    await loginAs(page, "emp");
    await page.goto("/report");
    await page
      .getByLabel("Description")
      .fill("External party emailed a security lead claiming to hold data and demanding payment.");
    await page.getByLabel("Related reference (optional)").fill("REPLAY-2016");
    await page.getByRole("button", { name: "Submit report" }).click();
    await page.getByRole("status").waitFor();
    await firePreset(page, /Cloud download alert/);
    await firePreset(page, /Bug bounty report/);
    await firePreset(page, /Payment request/);
    await raiseFlag(page, "CASE-0001", "Synthetic challenge for the screenshot set.");
    await page.close();
  });

  async function capture(
    browser: import("@playwright/test").Browser,
    views: Views,
  ) {
    for (const [name, v] of Object.entries(views)) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await ctx.newPage();
        if (v.as) await loginAs(page, v.as);
        await page.goto(v.path);
        if (name === "case-detail") {
          await page.getByRole("link", { name: "CASE-0001" }).click();
          await page.getByRole("region", { name: "Decision gate" }).waitFor();
        }
        else
          await page
            .getByRole("heading", { level: 1, name: ready[name] })
            .waitFor();
        if (name.startsWith("ledger"))
          await page.getByTestId("verify-result").waitFor();
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: `docs/evidence/screens/${vp.dir}/${name}.png`,
          fullPage: true,
        });
        await ctx.close();
      }
    }
  }

  test("pre-tamper views", async ({ browser }) => {
    await capture(browser, before);
  });

  test("post-tamper views", async ({ browser }) => {
    const page = await browser.newPage();
    await tamper(page, 2);
    await page.close();
    await capture(browser, afterTamper);
  });
});
