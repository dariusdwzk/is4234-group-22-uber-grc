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
