import { expect, test, type Page } from "@playwright/test";

// 고정된 Date.now()에서도 JS 시트 애니메이션이 멈추지 않게 한다.
test.use({ reducedMotion: "reduce" });

const date = "2026-10-29";
const wallet = {
  balance: 200,
  passive: { collectable: 3, collectedToday: 0, dailyLimit: 30, nextAt: null },
  equippedOutfitId: null,
};
const category = {
  id: 1,
  name: "식비",
  type: "EXPENSE",
  icon: "restaurant",
  color: "#0046FF",
  isDefault: true,
};
const transaction = {
  id: 1,
  type: "EXPENSE",
  amount: 12000,
  categoryId: 1,
  category,
  title: "점심",
  memo: null,
  occurredAt: "2026-10-28T12:00:00+09:00",
  createdAt: "2026-10-28T12:00:00+09:00",
  fromFixed: false,
};

async function session(page: Page) {
  await page.clock.setFixedTime(new Date(`${date}T12:00:00+09:00`));
  await page.addInitScript(() => {
    localStorage.setItem("flexable.service.token", "ui-ux-test");
    localStorage.setItem("flexable.service.homeStyle", "classic");
  });
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (data: unknown) => route.fulfill({ json: data });
    if (path === "/me")
      return json({
        id: 1,
        email: "ui@example.com",
        provider: "email",
        onboarded: true,
        createdAt: `${date}T00:00:00+09:00`,
      });
    if (path === "/budget/today")
      return json({
        date,
        nextPayday: "2026-11-25",
        cycleStart: "2026-10-26",
        daysLeft: 27,
        estimatedBalance: 500000,
        reservedFixed: 0,
        cardUnpaid: 0,
        protectedTotal: 0,
        remaining: 500000,
        dailyBudget: 10000,
        todaySpent: 12000,
        todayAvailable: -2000,
        shortage: 2000,
        weekSpent: 12000,
        weekDaysLeft: 4,
        weekAvailable: 28000,
        hasTransactions: true,
        characterPoints: 30,
        characterDelta: 15,
        dayPreset: "EVEN",
        dayBudgets: [10000, 10000, 10000, 10000, 10000, 10000, 10000],
      });
    if (path === "/budget/seed-money")
      return json({
        base: 50000,
        saved: 30000,
        total: 80000,
        monthlyGoal: 30000,
        pending: null,
        entries: [
          {
            cycleEnd: "2026-09-24",
            choice: "GOAL",
            amount: 30000,
            createdAt: "2026-09-25T12:00:00+09:00",
          },
        ],
      });
    if (path === "/coins") return json(wallet);
    if (path === "/coins/check-in") return json({ wallet, rewards: [] });
    if (path === "/coins/ledger")
      return json({
        items: [
          {
            id: 1,
            reason: "PASSIVE",
            amount: 3,
            refDate: null,
            outfitId: null,
            createdAt: `${date}T10:00:00+09:00`,
          },
        ],
        nextBefore: null,
      });
    if (path === "/coins/collect")
      return json({
        wallet: {
          ...wallet,
          balance: 203,
          passive: { ...wallet.passive, collectable: 0, collectedToday: 3 },
        },
        amount: 3,
      });
    if (path === "/outfits")
      return json({
        balance: 200,
        equippedOutfitId: null,
        peakLevel: 1,
        items: [
          {
            id: "costume-lv1",
            name: "광부",
            price: null,
            unlockLevel: 1,
            owned: true,
            equipped: true,
          },
        ],
      });
    if (path === "/categories") return json([category]);
    if (path === "/transactions/1") return json(transaction);
    if (path === "/transactions") {
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      return json({
        items:
          "2026-10-28" >= from && "2026-10-28" <= to
            ? [
                transaction,
                {
                  ...transaction,
                  id: 2,
                  title: "월세",
                  fromFixed: true,
                  amount: 300000,
                },
              ]
            : [],
      });
    }
    if (path === "/analysis/summary")
      return json({
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        expenseTotal: 20000,
        incomeTotal: 0,
        expenseCount: 2,
        byCategory: [
          {
            categoryId: 1,
            name: "식비",
            icon: "restaurant",
            color: "#0046FF",
            amount: 12000,
            count: 1,
            ratio: 0.6,
          },
          {
            categoryId: 2,
            name: "교통",
            icon: "bus",
            color: "#0B8A5B",
            amount: 8000,
            count: 1,
            ratio: 0.4,
          },
        ],
        byDay: [],
      });
    return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });
}

test("home help, weekly expenses and seed history use recorded data", async ({
  page,
}) => {
  await session(page);
  await page.goto("/home");
  await page.getByRole("button", { name: "레벨업 조건 및 가이드" }).click();
  await expect(page.getByText(/하루 예산 이하로 쓰면 \+15점/)).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page
    .getByRole("button", { name: "이번 주 일별 지출 내역 보기" })
    .click();
  await expect(
    page.getByRole("heading", { name: "이번 주 일별 지출 내역" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "점심, 12,000원, 상세 보기" }),
  ).toBeVisible();
  await expect(page.getByText("월세", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page.getByRole("button", { name: "오늘 예산 초과 도움말" }).click();
  await expect(
    page.getByRole("button", { name: "소비 분석 보기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  const history = page.getByRole("button", { name: "시드머니 모은 기록 보기" });
  await history.scrollIntoViewIfNeeded();
  await history.click();
  await expect(
    page.getByRole("heading", { name: "시드머니 모은 기록" }),
  ).toBeVisible();
  await expect(
    page.getByText("2026-09-24까지 · 매달 저축할 돈", { exact: true }),
  ).toBeVisible();
});

test("analysis resets to current month after navigating away and chart selects each category", async ({
  page,
}) => {
  await session(page);
  await page.goto("/analysis");
  await expect(page.getByText("2026년 10월", { exact: true })).toBeVisible();
  // Click the actual SVG paths: both slices must work, including the earlier slice beneath the later one.
  const chartLocator = page
    .locator('path[aria-label="식비, 12,000원, 1건"]')
    .locator("xpath=..");
  const chart = await chartLocator.boundingBox();
  if (!chart) throw new Error("Chart is missing");
  await page.mouse.click(
    chart.x + chart.width / 2 + 77,
    chart.y + chart.height / 2,
  );
  await expect(page.getByText("1건 · 60%", { exact: true })).toBeVisible();
  const moved = await chartLocator.boundingBox();
  if (!moved) throw new Error("Chart is missing");
  await page.mouse.click(
    moved.x + moved.width / 2 - 73,
    moved.y + moved.height / 2 - 24,
  );
  await expect(page.getByText("1건 · 40%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(page.getByText("2026년 11월", { exact: true })).toBeVisible();
  await expect(page.getByText("1건 · 40%", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "기본 홈", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "분석", exact: true }).click();
  await expect(page.getByText("2026년 10월", { exact: true })).toBeVisible();
});

test("notification highlight clears on opening an item and returning", async ({
  page,
}) => {
  await session(page);
  await page.goto("/notifications");
  const item = page.getByRole("button", { name: /새 알림, \+3 코인 모으기/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/coins\/history$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("button", { name: /^새 알림/ })).toHaveCount(0);
  const read = page.getByRole("button", { name: /^\+3 코인 모으기/ });
  await expect(read).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("past calendar day opens its expenses and initializes recording date; future day is disabled", async ({
  page,
}) => {
  await session(page);
  await page.goto("/transactions");
  await expect(
    page.getByRole("button", { name: "10월 30일", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^10월 28일,/ }).click();
  await expect(page).toHaveURL(/\/transactions\/day\?date=2026-10-28$/);
  await expect(
    page.getByRole("button", { name: "점심, 12,000원, 상세 보기" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "이 날짜에 지출 기록", exact: true })
    .click();
  await expect(page.getByLabel("날짜", { exact: true })).toHaveValue(
    "2026-10-28",
  );
  const input = page.getByLabel("금액", { exact: true });
  const fonts = await input.evaluate((el) => ({
    input: getComputedStyle(el).fontFamily,
    placeholder: getComputedStyle(el, "::placeholder").fontFamily,
  }));
  expect(fonts.input).toContain("Pretendard");
  expect(fonts.placeholder).toBe(fonts.input);
});

test("issued web code offers a clickable website card without putting the code in the URL", async ({
  page,
  context,
}) => {
  await session(page);
  await page.route("**/api/v1/me/web-links", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/me/web-link-codes", (route) =>
    route.fulfill({
      status: 201,
      json: { code: "A2B3C4", expiresAt: "2026-10-29T12:10:00+09:00" },
    }),
  );
  await context.route("https://solpa.shinhanacademy.co.kr/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Website</body></html>",
    }),
  );
  await page.goto("/web-links");
  await expect(
    page.getByRole("button", { name: "웹사이트에서 연동하기", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "선택 웹사이트 연동 개인정보 수집·이용 동의",
    })
    .click();
  await page
    .getByRole("button", { name: "웹 연동 코드 받기", exact: true })
    .click();
  await expect(page.getByText("A2B3C4", { exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "웹사이트에서 연동하기", exact: true })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://solpa.shinhanacademy.co.kr/");
});

test("FAQ toggles and collect dot clears after collection", async ({
  page,
}) => {
  await session(page);
  await page.goto("/support");
  const question = page.getByRole("button", {
    name: "잔액이 실제와 달라요",
    exact: true,
  });
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await question.click();
  await expect(page.getByText(/^표시된 금액은 입력한 잔액/)).toBeVisible();
  await question.click();
  await expect(page.getByText(/^표시된 금액은 입력한 잔액/)).toHaveCount(0);
  await page.goto("/customize");
  await expect(
    page.getByLabel("모을 코인 있음", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "모으기 +3", exact: true }).click();
  await expect(page.getByLabel("모을 코인 있음", { exact: true })).toHaveCount(
    0,
  );
});
