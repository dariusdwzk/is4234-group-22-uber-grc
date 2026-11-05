import { expect, test, type Page } from "@playwright/test";

// Phone width: no page may scroll sideways.
test.describe("phone width (375 px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  const fits = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  async function signIn(page: Page, name: RegExp): Promise<void> {
    const out = page.getByRole("button", { name: "Switch account" });
    if (await out.isVisible()) await out.click();
    await page.getByRole("button", { name }).click();
  }

  test("sign-in, GC My work, C-104 and Board overview fit", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.locator("#toast")).toHaveText("Demo reset.");
    expect(await fits(page)).toBe(true);

    // Get C-104 in front of the GC: Security's finding, the CSO's email and recommendation.
    await signIn(page, /^Security team/);
    await page.locator('[data-a="openCase"][data-x="C-104"]').first().click();
    await page.getByRole("button", { name: "Add finding" }).click();
    await expect(page.locator("#toast")).toHaveText(
      "Finding added to the case.",
    );
    await signIn(page, /^CSO/);
    await page.getByRole("button", { name: "Attach to case" }).click();
    await expect(page.locator("#toast")).toContainText("Email attached.");
    await page.getByLabel("Escalate internally").check();
    await page.locator("#rReason").fill("Keep it in-house for now.");
    await page.getByRole("button", { name: "Send to approvers" }).click();
    await expect(page.locator("#toast")).toContainText("Sent to the General");

    await signIn(page, /^General Counsel/);
    await expect(page.locator("nav.side")).toBeVisible();
    expect(await fits(page)).toBe(true);

    await page
      .locator("nav.side")
      .getByRole("button", { name: "My work" })
      .click();
    expect(await fits(page)).toBe(true);
    await page.locator('[data-a="openCase"][data-x="C-104"]').first().click();
    await expect(page.getByText("C-104").first()).toBeVisible();
    expect(await fits(page)).toBe(true);

    await signIn(page, /^Board/);
    await page
      .locator("nav.side")
      .getByRole("button", { name: "Overview" })
      .click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(await fits(page)).toBe(true);
  });
});
