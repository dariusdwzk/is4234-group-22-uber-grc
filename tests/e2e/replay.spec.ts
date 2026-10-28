import { expect, test, type Page } from "@playwright/test";

// The mockup's guided tour, clicked through in the browser, for both endings.
// Reduced motion: the guide then jumps (not smooth-scrolls) to the highlighted control.
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.selectOption("#roleSel", role);
}

async function reset(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Demo ▾" }).click();
  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.locator("#toast")).toHaveText("Demo reset.");
}

/** Guided steps 1-5: finding, email, recommendation, blocked close, Day 24, blocked release, GC approves. */
async function playToCpo(page: Page): Promise<void> {
  await page.goto("/");
  await reset(page);
  await page.getByRole("button", { name: "Start guided demo" }).click();
  await page.locator('[data-a="openCase"][data-x="C-104"]').click();
  await page.getByRole("button", { name: "Add finding" }).click();
  await expect(page.locator("#toast")).toHaveText("Finding added to the case.");

  await page
    .getByRole("button", { name: "Go as CSO (also Deputy GC)" })
    .click();
  await page.getByRole("button", { name: "Attach to case" }).click();
  await page.getByRole("button", { name: "Send for decision" }).click();
  await expect(
    page.getByText("Recommendation contradicts the evidence"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close case" }).click();
  await expect(page.getByText("Not allowed: Close case")).toBeVisible();
  await expect(page.getByText("Security cannot close cases.")).toBeVisible();

  await page
    .locator(".guidecard")
    .getByRole("button", { name: "Jump to Day 24" })
    .click();
  await expect(page.locator(".clock")).toContainText("Day 24");

  await page.getByRole("button", { name: "Go as Finance" }).click();
  await page.getByRole("button", { name: "Release payment" }).first().click();
  await expect(page.getByText("Payment held")).toBeVisible();

  await page.getByRole("button", { name: "Go as General Counsel" }).click();
  await page.locator("#v1").check();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator("#toast")).toHaveText(
    "Approved. Waiting for Chief Privacy Officer.",
  );
  await page
    .getByRole("button", { name: "Go as Chief Privacy Officer" })
    .click();
  await page.locator("#v1").check();
}

test("Ending A: the CPO rejects; payment cancelled, disclosure required, board told", async ({
  page,
}) => {
  await playToCpo(page);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.locator(".case-head")).toContainText("Disclosure required");

  await asRole(page, "finance");
  await expect(page.locator("tbody tr").first()).toContainText("Cancelled");

  await asRole(page, "board");
  await expect(page.locator(".brief")).toContainText(
    "A US$100,000 payment to the attacker was cancelled.",
  );
  await page.locator('[data-a="expand"][data-x="C-104"]').click();
  await expect(
    page.getByText(/rejected the recommendation to limit disclosure on C-104/),
  ).toBeVisible();
  const ack = page.getByRole("button", { name: "Acknowledge" });
  for (let left = await ack.count(); left > 0; left--) {
    await ack.first().click();
    await expect(ack).toHaveCount(left - 1);
  }

  await page.getByRole("button", { name: "Evidence log" }).click();
  await page.locator('[data-a="logFilter"][data-x="blocked"]').click();
  await expect(
    page.getByText("CSO (also Deputy GC) tried to close case. Not allowed."),
  ).toBeVisible();
  await expect(
    page.getByText("Finance tried to release payment. Not allowed."),
  ).toBeVisible();
  await expect(page.locator(".guidecard h3")).toHaveText("Demo complete");
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(
    page.locator("li", { hasText: "Records cannot be altered" }),
  ).toContainText("Intact");
});

test("Ending B: both approve; disclosure limited, payment approved for release, board told", async ({
  page,
}) => {
  await playToCpo(page);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.getByText("Disclosure limited by both approvers"),
  ).toBeVisible();

  await asRole(page, "finance");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Approved for release",
  );

  await asRole(page, "board");
  await expect(page.locator(".brief")).toContainText("Act now");
  await expect(page.locator(".brief")).toContainText(
    "Management decided to withhold disclosure.",
  );
  await expect(
    page.locator("li", { hasText: "Records cannot be altered" }),
  ).toContainText("Intact");
});

test("employees report anonymously and get a receipt code", async ({
  page,
}) => {
  await page.goto("/");
  await reset(page);
  await asRole(page, "employee");
  await page.locator("#eTxt").fill("Someone emailed me about rider data.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".alert.ok")).toContainText(
    /Report sent. Receipt code: RC-[0-9A-Z]{4}/,
  );
});
