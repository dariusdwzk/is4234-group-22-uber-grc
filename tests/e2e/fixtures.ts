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
