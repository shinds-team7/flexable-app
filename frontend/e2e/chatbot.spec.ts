import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

import { session } from "./ui-ux-fixtures";

test("AI 메이트: 실제 답변·서버 카드·확인 뒤에만 배분 저장·약속 설정은 업데이트 예정", async ({
  page,
}) => {
  await session(page);
  const chats: { mate: string; messages: { role: string; text: string }[] }[] =
    [];
  const saved: unknown[] = [];
  await page.route("**/api/v1/chat/messages", async (route) => {
    const body = route.request().postDataJSON();
    chats.push(body);
    const last = body.messages[body.messages.length - 1].text;
    await route.fulfill({
      json: last.includes("주말")
        ? {
            reply:
              "주말 약속이 많군요.\n\n요일별 배분을 **주말 넉넉히**로 바꿀까요?",
            action: { type: "DAY_PRESET", preset: "WEEKEND", label: "주말 넉넉히" },
          }
        : { reply: "이번 기간에는 **식비**에 가장 많이 썼어요.", action: null },
    });
  });
  await page.route("**/api/v1/budget/day-weights", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });

  await page.goto("/chatbot");
  await page.getByRole("radio", { name: "다정한 친구", exact: true }).click();
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();

  // 서버 기능이 없는 메뉴는 대화를 시작하지 않고 안내만 띄운다
  await page.getByRole("button", { name: "약속 설정", exact: true }).click();
  await expect(page.getByText("기능 업데이트 예정이에요")).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  expect(chats).toHaveLength(0);

  // 메뉴 질문 → 서버 답변 + /analysis/summary 값으로 그린 카드
  await page.getByRole("button", { name: "지출 흐름", exact: true }).click();
  await page.getByRole("button", { name: "어디에 제일 많이 썼어?" }).click();
  await expect(page.getByText(/가장 많이 썼어요/)).toBeVisible();
  await expect(page.getByText("20,000원", { exact: true })).toBeVisible();
  expect(chats[0].mate).toBe("FRIEND");
  // 화면 안내 말풍선은 보내지 않는다
  expect(chats[0].messages).toEqual([
    { role: "USER", text: "어디에 제일 많이 썼어?" },
  ]);

  // 배분 제안은 [확인]을 누르기 전에는 저장하지 않는다
  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  await input.fill("주말에 돈을 더 쓰고 싶어");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByRole("button", { name: "그대로 둘게" })).toBeVisible();
  expect(saved).toHaveLength(0);
  expect(chats[1].messages.map((m) => m.role)).toEqual([
    "USER",
    "MODEL",
    "USER",
  ]);
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText(/바꿨어요/)).toBeVisible();
  expect(saved).toEqual([{ preset: "WEEKEND" }]);
});

test("AI 메이트: 답변 실패는 다시 시도할 수 있다", async ({ page }) => {
  await session(page);
  let calls = 0;
  await page.route("**/api/v1/chat/messages", (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 502,
          json: {
            code: "CHAT_FAILED",
            message: "AI 메이트가 답하지 못했어요. 잠시 후 다시 시도해 주세요",
          },
        })
      : route.fulfill({ json: { reply: "다시 답했어요", action: null } }),
  );
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  await page
    .getByLabel("AI 메이트에게 질문", { exact: true })
    .fill("오늘 얼마 쓸 수 있어?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByText(/답하지 못했어요/)).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("다시 답했어요")).toBeVisible();
});

test("AI 메이트: 일정은 [등록]을 누른 뒤에만 예정 지출로 저장하고 서버 하루 예산을 보여 준다", async ({
  page,
}) => {
  await session(page);
  const chats: { accepts?: string[]; pending?: { amount?: number } }[] = [];
  const saved: unknown[] = [];
  const schedule = (amount: number) => ({
    title: "술약속",
    date: "2026-11-06",
    categoryId: 3,
    category: "식비",
    amount,
    basis: { samples: 5, scope: "SLOT", days: 90 },
    preview: { dayBudget: 75935, dailyBudgetBefore: 50000, dailyBudgetAfter: 48635 },
  });
  await page.route("**/api/v1/chat/messages", async (route) => {
    const body = route.request().postDataJSON();
    chats.push(body);
    await route.fulfill({
      json: body.pending
        ? {
            reply: "**50,000원**으로 바꿔서 등록할까요?",
            action: { type: "SCHEDULE", schedule: schedule(50000) },
          }
        : {
            reply: "금요일(11/6) 술약속에는 **27,300원** 정도 쓸 것 같아요. 등록할까요?",
            action: { type: "SCHEDULE", schedule: schedule(27300) },
          },
    });
  });
  await page.route("**/api/v1/scheduled-expenses", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  await input.fill("금요일 저녁에 술약속");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByText(/27,300원/)).toBeVisible();
  expect(chats[0].accepts).toEqual(["SCHEDULE"]);
  expect(saved).toHaveLength(0);

  // 피드백: 제안 내용을 서버에 함께 보내 다시 제안받는다. 아직 저장하지 않는다.
  await page.getByRole("button", { name: "금액·날짜 바꾸기" }).click();
  await input.fill("5만원으로 해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByText(/50,000원/).first()).toBeVisible();
  expect(chats[1].pending?.amount).toBe(27300);
  expect(saved).toHaveLength(0);

  // 서버가 계산한 날짜별 하루 예산을 등록 뒤에 그대로 보여 준다
  await page.route("**/api/v1/budget/today", async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      json: {
        ...(await res.json()),
        dailyBudget: 48635,
        dayPlans: [{ date: "2026-11-06", planned: 50000, budget: 98635 }],
      },
    });
  });
  await page.getByRole("button", { name: "등록", exact: true }).last().click();
  await expect(page.getByText(/예정 지출로 등록했어요/)).toBeVisible();
  await expect(page.getByText(/98,635원/).first()).toBeVisible();
  expect(saved).toEqual([
    { amount: 50000, categoryId: 3, title: "술약속", date: "2026-11-06" },
  ]);
});
