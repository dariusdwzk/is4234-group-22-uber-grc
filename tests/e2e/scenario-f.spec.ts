import { expect, test } from "@playwright/test";
import { advanceHours24, firePreset, loginAs, resetDemo } from "./fixtures";

test("Scenario F: +72h → GDPR escalation Tier 2 appears exactly once", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await advanceHours24(page, 3);
  await loginAs(page, "acc");
  const gdpr = page
    .getByTestId("tier2-item")
    .filter({ hasText: "GDPR Art. 33" });
  await page.goto("/board");
  await expect(gdpr).toHaveCount(1);
  await page.reload();
  await expect(gdpr).toHaveCount(1);
});
