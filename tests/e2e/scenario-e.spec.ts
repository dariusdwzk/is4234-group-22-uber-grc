import { expect, test } from "@playwright/test";
import { firePreset, loginAs, raiseFlag, resetDemo } from "./fixtures";

test("Scenario E: SA cannot dismiss a flag; IA resolves it", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await raiseFlag(page, "CASE-0001", "I doubt this was handled properly.");

  await loginAs(page, "sa");
  await page.goto("/flag");
  await expect(page.getByRole("button", { name: "Resolve flag" })).toHaveCount(
    0,
  );
  await page.goto("/board");
  await expect(page.getByText("could not be found")).toBeVisible();

  await loginAs(page, "ia");
  await page.goto("/flag");
  const form = page.getByRole("listitem").filter({ hasText: "CASE-0001" });
  await form.getByLabel("Resolution").fill("Reviewed the evidence; escalated.");
  await form.getByRole("button", { name: "Resolve flag" }).click();
  await expect(page.getByRole("button", { name: "Resolve flag" })).toHaveCount(
    0,
  );
});
