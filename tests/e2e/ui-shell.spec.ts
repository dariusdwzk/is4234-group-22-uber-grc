import { expect, test } from "@playwright/test";
import { firePreset, loginAs, raiseFlag, resetDemo } from "./fixtures";

const mainNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Main" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: "http://localhost:3000" });
  await resetDemo(page);
  await page.close();
});

test("skip link is the first tab stop", async ({ page }) => {
  await loginAs(page, "sa");
  await page.goto("/cases");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Skip to main content");
});

test("banner and one h1 on every page", async ({ page }) => {
  const visits: [Parameters<typeof loginAs>[1] | null, string[]][] = [
    ["sa", ["/cases", "/report", "/flag"]],
    ["acc", ["/board", "/ledger"]],
    ["demo", ["/demo"]],
  ];
  for (const [who, paths] of visits) {
    await loginAs(page, who!);
    for (const p of paths) {
      await page.goto(p);
      await expect(page.getByRole("note")).toContainText(
        "Demonstration — synthetic data",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
    }
  }
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page.getByRole("note")).toContainText(
    "Demonstration — synthetic data",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("nav shows only the role's links", async ({ page }) => {
  await loginAs(page, "emp");
  await page.goto("/report");
  const nav = mainNav(page);
  await expect(nav.getByRole("link", { name: "Report" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Flag" })).toBeVisible();
  for (const n of ["Cases", "Board", "Ledger", "Demo"])
    await expect(nav.getByRole("link", { name: n })).toHaveCount(0);

  await loginAs(page, "acc");
  await page.goto("/board");
  await expect(mainNav(page).getByRole("link", { name: "Board" })).toBeVisible();
  await expect(mainNav(page).getByRole("link", { name: "Ledger" })).toBeVisible();
});

test("active link has aria-current", async ({ page }) => {
  await loginAs(page, "sa");
  await page.goto("/cases");
  await expect(
    mainNav(page).getByRole("link", { name: "Cases" }),
  ).toHaveAttribute("aria-current", "page");
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await firePreset(page, /Cloud download alert/);
  await raiseFlag(page, "CASE-0001", "x".repeat(2000));
  await page.setViewportSize({ width: 375, height: 812 });
  const noOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
  await page.goto("/flag");
  expect(await noOverflow()).toBe(true);
  await loginAs(page, "sa");
  await page.goto("/cases");
  expect(await noOverflow()).toBe(true);
  await loginAs(page, "acc");
  await page.goto("/ledger");
  expect(await noOverflow()).toBe(true);
});

test("mobile menu opens by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, "sa");
  await page.goto("/report");
  const summary = page.getByText("Menu", { exact: true });
  const cases = mainNav(page).getByRole("link", { name: "Cases" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(cases).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(cases).toBeHidden();
});

test("board shows the 371-day comparison and Tier 2 inbox on the first screen", async ({
  page,
}) => {
  await firePreset(page, /Cloud download alert/);
  await raiseFlag(page, "CASE-0001", "Board layout check flag.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, "acc");
  await page.goto("/board");
  await expect(page.getByTestId("kpi-uber")).toContainText("371");
  await expect(page.getByTestId("kpi-uber")).toBeInViewport();
  // compare bar: one decorative track per side
  await expect(
    page.getByTestId("kpi-uber").locator('[aria-hidden="true"]'),
  ).toHaveCount(2);
  await expect(page.getByTestId("head-status")).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Tier 2 inbox" }),
  ).toBeInViewport();
});

test("cases list and case detail keep their contract in the dashboard layout", async ({
  page,
}) => {
  await resetDemo(page);
  await loginAs(page, "emp");
  await page.goto("/report");
  await page
    .getByLabel("Description")
    .fill("External party demanded payment for rider data.");
  await page.getByLabel("Related reference (optional)").fill("REPLAY-2016");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toContainText("Thank you");
  await firePreset(page, /Cloud download alert/);
  await firePreset(page, /Bug bounty report/);
  await firePreset(page, /Payment request/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, "sa");
  await page.goto("/cases");
  await expect(page.getByRole("link", { name: /CASE-/ })).toHaveCount(1);
  await expect(
    page.getByRole("row", { name: /CASE-0001/ }).getByText("HIGH"),
  ).toBeVisible();

  await page.getByRole("link", { name: "CASE-0001" }).click();
  await expect(page.getByTestId("tier")).toHaveText("HIGH");
  await expect(page.getByTestId("status")).toHaveText("open");
  await expect(
    page.getByRole("region", { name: "Events" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Decision gate" }),
  ).toBeInViewport();
  await expect(page.getByRole("button", { name: "Close case" })).toBeEnabled();
});
