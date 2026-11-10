import { expect, test } from "@playwright/test";
import { session } from "./ui-ux-fixtures";
test.use({ reducedMotion: "reduce" });

for (const amount of [0, 45000, -2000]) {
  test(`home cards match and the seed plus clears the footer with budget ${amount}`, async ({
    page,
  }) => {
    await session(page);
    // Keep fixture fields and change only the budget returned by the server.
    await page.route("**/api/v1/budget/today", (route) =>
      route.fulfill({
        json: {
          date: "2026-10-29",
          nextPayday: "2026-11-25",
          cycleStart: "2026-10-26",
          daysLeft: 27,
          remaining: 500000,
          estimatedBalance: 500000,
          reservedFixed: 0,
          reservedPlanned: 0,
          cardUnpaid: 0,
          protectedTotal: 0,
          dailyBudget: 45000,
          todaySpent: 0,
          todayAvailable: amount,
          shortage: 0,
          weekSpent: 0,
          weekDaysLeft: 4,
          weekAvailable: 180000,
          characterPoints: 40,
          characterDelta: 20,
          hasTransactions: true,
          dayPreset: "EVEN",
          dayBudgets: [45000, 45000, 45000, 45000, 45000, 45000, 45000],
          dayPlans: [],
        },
      }),
    );
    await page.goto("/home");
    const today = page.getByLabel("오늘 예산 카드", { exact: true });
    const seed = page.getByRole("button", {
      name: "시드머니 모은 기록 보기",
      exact: true,
    });
    await expect(today).toBeVisible();
    await expect
      .poll(async () => {
        const a = await today.boundingBox(),
          b = await seed.boundingBox();
        return a && b ? Math.abs(a.height - b.height) : 999;
      })
      .toBeLessThanOrEqual(1);
    const plus = await page
      .getByRole("button", { name: "시드머니로 돈 보내기", exact: true })
      .boundingBox();
    const foot = await page
      .getByLabel("시드머니 구성", { exact: true })
      .boundingBox();
    expect(plus && foot && plus.y + plus.height + 8 <= foot.y).toBe(true);
    const help = page.getByRole("button", {
      name: "시드머니가 무엇인지 보기",
      exact: true,
    });
    await help.scrollIntoViewIfNeeded();
    await help.click();
    await expect(
      page.getByRole("heading", { name: "시드머니가 뭐예요?", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "시드머니 모은 기록", exact: true }),
    ).toHaveCount(0);
  });
}

test("analysis has week/month arrows and a compact three-choice all-period menu", async ({
  page,
}) => {
  await session(page, "2026-11-09");
  await page.goto("/analysis");
  await expect(page.getByText("2026년 11월", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "이번 주", exact: true }).click();
  await expect(page.getByText("11/9 ~ 11/15", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이전 주", exact: true }).click();
  await expect(page.getByText("11/2 ~ 11/8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await expect(page.getByText("11/9 ~ 11/15", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "이번 달", exact: true }).click();
  await expect(page.getByText("2026년 11월", { exact: true })).toBeVisible();
  await expect(page.getByText("이전 달", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(page.getByText("2026년 10월", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page
    .getByRole("button", { name: "분석 기간 선택", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "1개월 기간으로 보기", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "3개월 기간으로 보기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "분석 기간 선택", exact: true }),
  ).toContainText("3개월");
});

test("inbox fills the available screen width", async ({ page }) => {
  await session(page);
  await page.goto("/notifications");
  const box = await page.getByLabel("알림 목록", { exact: true }).boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(390);
  expect(box && box.y + box.height).toBe(844);
});
