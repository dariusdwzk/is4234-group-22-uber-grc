import { expect, test } from "@playwright/test";
import { REPLAY_PRESETS } from "../../src/server/demo/replay-presets";
import { firePreset, loginAs, raiseFlag, resetDemo, tamper } from "./fixtures";

// Cold-start guard: wait until the document is rendered before keyboard input.
const ready = async (page: import("@playwright/test").Page) => {
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeAttached();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

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
  await ready(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
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
  await expect(
    mainNav(page).getByRole("link", { name: "Board" }),
  ).toBeVisible();
  await expect(
    mainNav(page).getByRole("link", { name: "Ledger" }),
  ).toBeVisible();
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
  await ready(page);
  expect(await noOverflow()).toBe(true);
  await loginAs(page, "sa");
  await page.goto("/cases");
  await ready(page);
  expect(await noOverflow()).toBe(true);
  await loginAs(page, "acc");
  await page.goto("/ledger");
  await ready(page);
  expect(await noOverflow()).toBe(true);
});

test("mobile menu opens by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, "sa");
  await page.goto("/report");
  await ready(page);
  const summary = page.getByText("Menu", { exact: true });
  const cases = mainNav(page).getByRole("link", { name: "Cases" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(cases).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(cases).toBeHidden();

  await page.keyboard.press("Enter");
  await cases.click();
  await expect(page).toHaveURL(/\/cases/);
  await expect(cases).toBeHidden();
});

test("reason code select shows a focus ring", async ({ page }) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await loginAs(page, "gc");
  await page.goto("/cases");
  await page.getByRole("link", { name: "CASE-0001" }).click();
  const select = page.getByLabel("Reason code");
  await page.getByLabel("Notify-by date (only for notify later)").focus();
  // a date input has several inner tab stops (month, day, year, picker)
  for (
    let i = 0;
    i < 6 && !(await select.evaluate((e) => e === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(select).toBeFocused();
  await expect(select).toHaveCSS("outline-style", "solid");
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
  const clocks = page.getByRole("region", { name: "Clocks (illustrative)" });
  const gateBox = await page.getByRole("region", { name: "Decision gate" }).boundingBox();
  const clocksBox = await clocks.boundingBox();
  expect(clocksBox!.y).toBeGreaterThan(gateBox!.y + gateBox!.height);
  expect(clocksBox!.width).toBeGreaterThan(900);
  const due = page.locator('[data-testid^="clock-"]').nth(1).locator("td").nth(2);
  await expect(due).toHaveCSS("white-space", "nowrap");
  expect((await due.boundingBox())!.height).toBeLessThan(48);
  await expect(page.locator('[data-testid^="clock-"]').first()).toBeVisible();
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="clock-"]')].flatMap((tr) => [
        ...[...tr.querySelectorAll("td")].map((c) => c.scrollWidth > c.clientWidth),
        (tr.closest(".overflow-x-auto") as HTMLElement).scrollWidth >
          (tr.closest(".overflow-x-auto") as HTMLElement).clientWidth,
      ]),
    ),
  ).not.toContain(true);
});

test("ledger shows verify result, failure label and a Demo only region", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await loginAs(page, "ia");
  await page.goto("/ledger?verify=1");
  await expect(page.getByTestId("verify-result")).toContainText("Ledger OK");
  await expect(page.getByTestId("entry-count")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Demo only" })).toHaveCount(0);

  await tamper(page, 2);
  await expect(
    page
      .getByRole("region", { name: "Demo only" })
      .getByRole("button", { name: /alter entry/i }),
  ).toBeVisible();
  await loginAs(page, "ia");
  await page.goto("/ledger?verify=1");
  await expect(page.getByTestId("verify-result")).toContainText(
    "Verification failed at entry",
  );
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Key columns (#, Time, Actor, Event) stay readable without sideways scrolling.
  await expect(page.getByRole("columnheader", { name: "Time" })).toBeHidden();
  const firstEvent = await page.locator("tbody tr").first().locator("td").nth(3).boundingBox();
  // Event names may wrap only at underscores: each cell's longest word fits.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("tbody tr td:nth-child(4)")].some(
        (c) => c.scrollWidth > c.clientWidth,
      ),
    ),
  ).toBe(false);
  expect(firstEvent!.x + firstEvent!.width).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("columnheader", { name: "Time" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  const eventHead = await page
    .getByRole("columnheader", { name: "Event" })
    .boundingBox();
  const eventCell = await page.locator("tbody tr").first().locator("td").nth(3).boundingBox();
  expect(eventHead!.x + eventHead!.width).toBeLessThanOrEqual(375);
  expect(eventCell!.x + eventCell!.width).toBeLessThanOrEqual(375);
});

test("demo panel groups replay, clock and reset", async ({ page }) => {
  await loginAs(page, "demo");
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Demo panel" })).toBeVisible();
  const replay = page.getByRole("region", { name: "Replay scenario" });
  const labels = await replay.getByRole("button").allTextContents();
  expect(labels).toEqual(Object.values(REPLAY_PRESETS).map((p) => p.label));
  const reset = page.getByRole("region", { name: "Reset" });
  await expect(reset.getByRole("button", { name: "Reset demo" })).toBeVisible();
  await expect(reset.getByRole("button", { name: "Advance +24h" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Advance +24h" }),
  ).toBeVisible();
});

test("report receipt and flag confirmation use one status each", async ({
  page,
}) => {
  await loginAs(page, "emp");
  await page.goto("/report");
  await page.getByLabel("Description").fill("Layout check report.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("Thank you — receipt");
  await page.goto("/flag");
  await page.getByLabel("Case reference").fill("CASE-0001");
  await page.getByLabel("What concerns you?").fill("Layout check flag text.");
  await page.getByRole("button", { name: "Raise flag" }).click();
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText(
    "Flag recorded for review.",
  );
});

test("board integrity card shows the alert icon when verification fails", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await loginAs(page, "ia");
  await page.goto("/ledger");
  await page.getByRole("button", { name: "Export head" }).click();
  await tamper(page, 2);
  await loginAs(page, "acc");
  await page.goto("/board");
  await expect(page.getByTestId("head-status")).toContainText("Verification failed");
  const card = page.getByTestId("head-status").locator("..");
  await expect(card.locator('svg path[d^="M12 3 2 20"]')).toHaveCount(1);
  await expect(card.locator('svg circle')).toHaveCount(0);
});

test("board integrity card shows the alert icon when the export line says DOES NOT MATCH", async ({
  page,
}) => {
  await resetDemo(page);
  await loginAs(page, "ia");
  await page.goto("/ledger");
  await page.getByRole("button", { name: "Export head" }).click();
  await resetDemo(page);
  await loginAs(page, "acc");
  await page.goto("/board");
  await expect(page.getByTestId("head-status")).toContainText("Verified");
  await expect(page.getByTestId("head-status")).toContainText("DOES NOT MATCH");
  const card = page.getByTestId("head-status").locator("..");
  await expect(card.locator('svg path[d^="M12 3 2 20"]')).toHaveCount(1);
});
