import { expect, test } from "@playwright/test";
import {
  firePreset,
  loginAs,
  resetDemo,
  tamper,
  verifyLedger,
} from "./fixtures";

test("Scenario D: tamper → verify fails at N; exported head still reported", async ({
  page,
}) => {
  await resetDemo(page);
  await firePreset(page, /Cloud download alert/);
  await loginAs(page, "ia");
  await page.goto("/ledger");
  await page.getByRole("button", { name: "Export head" }).click();
  await verifyLedger(page);
  await expect(page.getByTestId("verify-result")).toContainText("Ledger OK");

  await tamper(page, 3);
  await loginAs(page, "ia");
  await page.goto("/ledger");
  await verifyLedger(page);
  const result = page.getByTestId("verify-result");
  await expect(result).toContainText("Verification failed at entry 3");
  await expect(result).toContainText("Exported head at entry");
});
