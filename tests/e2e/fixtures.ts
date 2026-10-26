import { expect, type Page } from "@playwright/test";
import { SEED_USERS } from "../../src/server/seed/users";

export async function loginAs(
  page: Page,
  key: keyof typeof SEED_USERS,
): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(SEED_USERS[key].email);
  await page.getByLabel("Password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function resetDemo(page: Page): Promise<void> {
  await loginAs(page, "demo");
  page.once("dialog", (d) => void d.accept());
  await page.goto("/demo");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function firePreset(page: Page, label: RegExp): Promise<void> {
  await loginAs(page, "demo");
  await page.goto("/demo");
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByRole("heading", { name: "Demo panel" })).toBeVisible();
}

export async function advanceHours24(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await loginAs(page, "demo");
    await page.goto("/demo");
    await page.getByRole("button", { name: "Advance +24h" }).click();
    // 24h of demo time outlives the 8h session, so the redirect lands on the login page.
    await expect(page).toHaveURL(/\/login/);
  }
}

export async function decide(
  page: Page,
  who: "gc" | "pco",
  outcome: "Notify now" | "Withhold",
): Promise<void> {
  await loginAs(page, who);
  await page.goto("/cases");
  await page.getByRole("link", { name: "CASE-0001" }).click();
  await page.getByLabel(outcome).check();
  await page.getByLabel("Reason code").selectOption("LEGAL_ADVICE");
  for (const box of await page
    .getByRole("group", { name: /Checklist/ })
    .getByRole("checkbox")
    .all())
    await box.check();
  await page.getByRole("button", { name: "Submit decision" }).click();
}

export async function raiseFlag(
  page: Page,
  caseRef: string,
  text: string,
): Promise<void> {
  await loginAs(page, "emp");
  await page.goto("/flag");
  await page.getByLabel("Case reference").fill(caseRef);
  await page.getByLabel("What concerns you?").fill(text);
  await page.getByRole("button", { name: "Raise flag" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Flag recorded for review.",
  );
}

export async function tamper(page: Page, seq: number): Promise<void> {
  await loginAs(page, "demo");
  await page.goto("/ledger");
  await page.getByLabel("Entry number").fill(String(seq));
  await page.getByRole("button", { name: /alter entry/i }).click();
  await expect(page.getByLabel("Entry number")).toBeVisible();
}

export async function verifyLedger(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Verify ledger" }).click();
  await expect(page.getByTestId("verify-result")).toBeVisible();
}
