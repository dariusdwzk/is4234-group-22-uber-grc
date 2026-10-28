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

async function answer(
  page: Page,
  answers: Record<string, string>,
): Promise<void> {
  for (const q of [
    "data",
    "money",
    "harm",
    "handling",
    "systems",
    "outsiders",
    "ongoing",
  ])
    await page
      .locator(`input[name="q-${q}"][value="${answers[q] ?? "NO"}"]`)
      .check();
}

test("an employee's report runs through the same flow: rated by the rules, board told", async ({
  page,
}) => {
  await page.goto("/");
  await reset(page);
  await asRole(page, "employee");
  await page
    .locator("#eTxt")
    .fill("Someone emailed me demanding money for rider data.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator("#toast")).toHaveText(
    "Answer every question: Yes, No or Not sure.",
  );
  await answer(page, { data: "YES", money: "YES", outsiders: "YES" });
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".alert.ok")).toContainText(
    /Report sent. Receipt code: RC-[0-9A-Z]{4}/,
  );

  await asRole(page, "security");
  await page.locator('[data-a="openCase"][data-x="C-105"]').click();
  await expect(page.locator(".case-head")).toContainText("HIGH");
  await expect(
    page.getByText("Reported by staff; scale not yet known").first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add finding" })).toBeVisible();
});

test("unsure reporter → triage; Security cannot rate, the CPO can", async ({
  page,
}) => {
  await page.goto("/");
  await reset(page);
  await asRole(page, "employee");
  await page.locator("#eTxt").fill("Lost a laptop that may have rider data.");
  await answer(page, { data: "NOT_SURE" });
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".alert.ok")).toBeVisible();

  await asRole(page, "security");
  await expect(page.locator("tr", { hasText: "C-105" })).toContainText(
    "Needs triage",
  );
  await page.locator('[data-a="openCase"][data-x="C-105"]').click();
  await page.getByRole("button", { name: "Confirm rating" }).click();
  await expect(page.getByText("Not allowed: Confirm rating")).toBeVisible();

  await asRole(page, "cpo");
  await page.locator('[data-a="openCase"][data-x="C-105"]').click();
  await page.selectOption("#tRating", "LOW");
  await page.locator("#tReason").fill("Encrypted and wiped remotely.");
  await page.getByRole("button", { name: "Confirm rating" }).click();
  await expect(page.locator("#toast")).toHaveText(
    "Rated LOW. Security reviews it within 3 business days.",
  );
});

test("a concern about how Security handles a case never reaches Security", async ({
  page,
}) => {
  await page.goto("/");
  await reset(page);
  await asRole(page, "employee");
  await page.locator("#eTxt").fill("The CSO is calling a breach a bug bounty.");
  await answer(page, { handling: "YES" });
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.locator(".alert.ok")).toBeVisible();

  await asRole(page, "security");
  await expect(page.locator('[data-x="C-104"]').first()).toBeVisible(); // Security's list has loaded
  await expect(page.locator('[data-x="C-105"]')).toHaveCount(0);
  await asRole(page, "gc");
  await expect(
    page.locator("section", { hasText: "Handled independently of Security" }),
  ).toContainText("C-105");
});
