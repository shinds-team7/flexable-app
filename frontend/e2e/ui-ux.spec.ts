import { expect, test } from "@playwright/test";

// 고정된 Date.now()에서도 JS 시트 애니메이션이 멈추지 않게 한다.
test.use({ reducedMotion: "reduce" });

import { session } from "./ui-ux-fixtures";

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
    page.getByRole("heading", { name: "이번 주 평일 지출 내역" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "점심, 12,000원, 상세 보기" }),
  ).toBeVisible();
  await expect(page.getByText("월세", { exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();
  await page
    .getByRole("button", { name: "계산 근거 보기" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "오늘 예산 초과 도움말" }).click();
  await expect(page).toHaveURL(/\/chatbot\?/);
  await page.getByRole("radio", { name: "똑똑한 분석가", exact: true }).click();
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  await expect(
    page.getByLabel("AI 메이트에게 질문", { exact: true }),
  ).toHaveValue("오늘 예산을 넘겼어요. 기록을 바탕으로 도움을 주세요");
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

test("only tapped notifications lose their highlight, including after re-entry and reload", async ({
  page,
}) => {
  await session(page);
  await page.goto("/notifications");
  const unread = page.getByRole("button", { name: /^새 알림/ });
  await expect(unread).toHaveCount(3);
  // Merely leaving and re-entering the list never acknowledges anything.
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  const bell = page.getByRole("button", {
    name: "알림함, 새 알림 있음",
    exact: true,
  });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(unread).toHaveCount(3);
  // Open the newest notification first: older ones must stay unread.
  await page
    .getByRole("button", { name: /^새 알림, 오늘 예산을 넘었어요/ })
    .click();
  await expect(page).toHaveURL(/\/home$/);
  await bell.click();
  await expect(unread).toHaveCount(2);
  const item = page.getByRole("button", { name: /새 알림, \+3 코인 모으기/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/coins\/history$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(unread).toHaveCount(1);
  const read = page.getByRole("button", { name: /^\+3 코인 모으기/ });
  await expect(read).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const remaining = page.getByRole("button", {
    name: /^새 알림, 고정지출을 기록했어요/,
  });
  await expect(remaining).toHaveCSS("background-color", "rgb(235, 240, 255)");
  await page.reload();
  await expect(unread).toHaveCount(1);
  await expect(read).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await remaining.click();
  await expect(page).toHaveURL(/\/transactions\/2$/);
  await page.goBack();
  await expect(unread).toHaveCount(0);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "알림함", exact: true }),
  ).toBeVisible();
});

test("calendar branches into future planning and past records with the selected date", async ({
  page,
}) => {
  await session(page);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "10월 30일", exact: true }).click();
  await expect(page).toHaveURL(/\/scheduled-expenses\?date=2026-10-30$/);
  await expect(page.getByLabel("예정 날짜", { exact: true })).toHaveValue(
    "2026-10-30",
  );
  await page.goBack();
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
