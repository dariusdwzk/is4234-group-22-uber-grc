import { expect, test } from "@playwright/test";
import { decide, firePreset, loginAs, resetDemo } from "./fixtures";

test("Scenario B: one approver declines → Tier 2 → ACC acknowledges", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await decide(page, "gc", "Notify now");
  await decide(page, "pco", "Withhold");
  await expect(page.getByTestId("status")).toHaveText("open");

  await loginAs(page, "acc");
  await page.goto("/board");
  const item = page.getByTestId("tier2-item").filter({ hasText: "disagree" });
  await expect(item).toHaveCount(1);
  await item.getByLabel("Action note").fill("Asked both to reconcile today.");
  await item.getByRole("button", { name: "Acknowledge" }).click();
  await expect(item).toContainText("Handled: Asked both to reconcile today.");
});
