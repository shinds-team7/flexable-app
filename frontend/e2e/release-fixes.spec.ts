import { expect, test } from "@playwright/test";
import { session } from "./ui-ux-fixtures";

test.use({ reducedMotion: "reduce" });

test("출석 보상 잠금·해금과 도전과제·예정 칸에 고양이·짙은 가림·흰 자물쇠 표시", async ({
  page,
}) => {
  await session(page);
  let owned = false;
  await page.route("**/api/v1/outfits", (route) =>
    route.fulfill({
      json: {
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
          {
            id: "outfit-03",
            name: "선비냥이",
            price: 200,
            unlockLevel: null,
            owned: false,
            equipped: false,
          },
          {
            id: "outfit-07",
            name: "달밤 낚시 고양이",
            price: 200,
            unlockLevel: null,
            owned: false,
            equipped: false,
          },
          {
            id: "outfit-06",
            name: "출석 보상",
            price: null,
            unlockLevel: null,
            owned,
            equipped: false,
          },
        ],
      },
    }),
  );
  await page.goto("/customize");
  const reward = page.getByRole("button", { name: "출석 보상", exact: true });
  await expect(reward).toBeDisabled();
  const thumbnail = reward.getByTestId("locked-outfit-thumbnail");
  await expect(thumbnail.locator("img")).toBeVisible();
  await expect(thumbnail.locator("img")).toHaveAttribute("src", /cat-unlock/);
  await expect
    .poll(() =>
      thumbnail
        .locator("img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  const thumbBox = await thumbnail.boundingBox();
  const imageBox = await thumbnail.locator("img").boundingBox();
  expect(imageBox!.width).toBeLessThanOrEqual(thumbBox!.width + 1);
  expect(imageBox!.height).toBeLessThanOrEqual(thumbBox!.height + 1);
  await expect
    .poll(() =>
      thumbnail
        .locator("div")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) =>
              getComputedStyle(node).backgroundColor ===
              "rgba(16, 24, 40, 0.64)",
          ),
        ),
    )
    .toBe(true);
  const upcoming = page.getByLabel("준비 중인 코스튬, 업데이트 예정");
  await expect(upcoming).toHaveCount(2);
  for (const slot of await upcoming.all())
    await expect(
      slot.getByTestId("locked-outfit-thumbnail").locator("img"),
    ).toBeVisible();
  await page.screenshot({
    path: "test-results/costume-locks.png",
    fullPage: true,
  });
  owned = true;
  await page.reload();
  await expect(reward).toBeEnabled();
  await expect(reward.getByTestId("locked-outfit-thumbnail")).toHaveCount(0);
  await expect(reward.locator("img")).toBeVisible();
  await reward.click();
  await expect(
    page.getByRole("button", { name: "적용하기", exact: true }),
  ).toBeEnabled();
});

test("AI가 도구 없이 배분 변경 버튼을 안내해도 실제 배분 화면을 연다", async ({
  page,
}) => {
  await session(page);
  await page.addInitScript(() =>
    localStorage.setItem("chatbot.mate", "FRIEND"),
  );
  let writes = 0;
  await page.route("**/api/v1/chat/messages", (route) =>
    route.fulfill({
      json: {
        reply: "하루 예산 배분을 바꾸고 싶다면 아래 버튼을 눌러보세요",
        action: null,
      },
    }),
  );
  await page.route("**/api/v1/budget/day-weights", (route) => {
    if (route.request().method() === "PUT") writes++;
    return route.fulfill({
      json: {
        preset: "EVEN",
        weights: [14, 14, 14, 14, 14, 14, 14],
        min: 5,
        max: 30,
        presets: [],
        record: {
          from: null,
          to: "2026-10-28",
          days: 0,
          weekdays: 0,
          minDays: 7,
          minWeekdays: 3,
        },
      },
    });
  });
  await page.goto("/chatbot");
  if (
    await page
      .getByRole("radio", { name: "다정한 친구", exact: true })
      .isVisible()
  ) {
    await page.getByRole("radio", { name: "다정한 친구", exact: true }).click();
    await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  }
  await page.getByRole("button", { name: "기타", exact: true }).click();
  await page
    .getByLabel("AI 메이트에게 질문", { exact: true })
    .fill("배분을 바꾸려면?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  const button = page.getByRole("button", {
    name: "하루 예산 배분 바꾸기",
    exact: true,
  });
  await expect(button).toBeVisible();
  expect(writes).toBe(0);
  await button.click();
  await expect(page).toHaveURL(/\/budget\/day-weights$/);
  expect(writes).toBe(0);
});

test("예산 설정의 모아둔 돈 옆 도움말은 시드머니 카드와 같은 설명을 연다", async ({
  page,
}) => {
  await session(page);
  await page.route("**/api/v1/budget/settings", (route) =>
    route.fulfill({
      json: {
        balance: 500000,
        balanceAt: "2026-10-29T12:00:00+09:00",
        payday: 25,
        incomeAmount: 2000000,
        cardUnpaid: 0,
        seedBase: 50000,
        fixedExpenses: [],
        protectedItems: [],
      },
    }),
  );
  await page.goto("/budget/settings");
  await expect(page.getByRole("heading", { name: "모아둔 돈", exact: true })).toBeVisible();
  await expect(page.getByText("(시드머니", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "시드머니가 무엇인지 보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "시드머니가 뭐예요?", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "웹서비스 연동하기", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByLabel("모아둔 돈 (원)", { exact: true })).toHaveValue(
    "50,000",
  );
});

test("시드머니는 총액·이번 달 목표만 표시하고 총액 정정 API로 저장한다", async ({
  page,
}) => {
  await session(page);
  let total = 80000;
  const writes: unknown[] = [];
  await page.route("**/api/v1/budget/seed-money", (route) =>
    route.fulfill({
      json: {
        base: 50000,
        saved: total - 50000,
        total,
        monthlyGoal: 30000,
        movable: 100000,
        pending: null,
        entries: [],
      },
    }),
  );
  await page.route("**/api/v1/budget/seed-money/total", (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    total = body.total;
    return route.fulfill({ json: {} });
  });
  await page.goto("/home");
  await expect(
    page.getByLabel("지금까지 모은 돈 80,000원", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("이번 달 모을 돈 30,000원", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("반영한 돈", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "시드머니가 무엇인지 보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "시드머니가 뭐예요?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "시드머니 모은 기록", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "시드머니 모은 기록 보기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "시드머니 수정", exact: true })
    .click();
  await page.getByLabel("지금까지 모은 돈 (원)", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByLabel("시드머니 10,000원", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([{ total: 10000 }]);
});
