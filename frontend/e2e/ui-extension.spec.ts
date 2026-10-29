import { expect, test } from "@playwright/test";
import { session, category } from "./ui-ux-fixtures";
import type { ScheduledExpense } from "../src/service/types";
test.use({ reducedMotion: "reduce" });

test("future expense creation, editing, reload and deletion use the scheduled API", async ({
  page,
}) => {
  await session(page);
  let saved: ScheduledExpense[] = [];
  await page.route("**/api/v1/scheduled-expenses**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({
        amount: 25000,
        categoryId: 1,
        title: "생일 선물",
        date: "2026-10-30",
      });
      saved = [
        {
          ...body,
          id: 1,
          category,
          createdAt: "2026-10-29T12:00:00+09:00",
          updatedAt: "2026-10-29T12:00:00+09:00",
        },
      ];
      return route.fulfill({ status: 201, json: saved[0] });
    }
    if (method === "PUT") {
      saved = [{ ...saved[0], ...route.request().postDataJSON() }];
      return route.fulfill({ json: saved[0] });
    }
    if (method === "DELETE") {
      saved = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { items: saved } });
  });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "10월 30일", exact: true }).click();
  await page.getByLabel("예정 금액 (원)", { exact: true }).fill("25000");
  await page.getByLabel("예정 지출 내용", { exact: true }).fill("생일 선물");
  await page
    .getByRole("button", { name: "예정 지출 등록", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "생일 선물 수정", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "생일 선물 수정", exact: true })
    .click();
  await page.getByLabel("예정 금액 (원)", { exact: true }).fill("30000");
  await page
    .getByRole("button", { name: "예정 지출 수정", exact: true })
    .click();
  await expect(
    page.getByText("30,000원 · 식비", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "생일 선물 삭제", exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(
    page.getByText("등록한 지출 예정이 없어요", { exact: true }),
  ).toBeVisible();
});

test("default categories can move and delete with their saved server order", async ({
  page,
}) => {
  await session(page);
  let categories = [
    category,
    { ...category, id: 2, name: "교통", icon: "bus" },
  ];
  await page.route("**/api/v1/categories**", async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ type: "EXPENSE", ids: [2, 1] });
      categories = [categories[1], categories[0]];
    }
    if (method === "DELETE") {
      categories = categories.filter((c) => c.id !== 1);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: categories });
  });
  await page.goto("/categories");
  await page
    .getByRole("button", { name: "식비 아래로 이동", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "식비 위로 이동", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "교통 위로 이동", exact: true }),
  ).toBeDisabled();
  const food = page.getByText("식비", { exact: true }).locator("xpath=../..");
  await food.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).last().click();
  await expect(page.getByText("식비", { exact: true })).toHaveCount(0);
});

test("Gemini setup failure retries the same question and budget proposal requires confirmation", async ({
  page,
}) => {
  await session(page);
  let calls = 0;
  let first: unknown;
  let changes = 0;
  await page.route("**/api/v1/chat/messages", (route) => {
    const body = route.request().postDataJSON();
    calls++;
    if (calls === 1) {
      first = body;
      return route.fulfill({
        status: 503,
        json: { code: "CHAT_UNAVAILABLE", message: "준비 중" },
      });
    }
    expect(body).toEqual(first);
    return route.fulfill({
      json: {
        reply: "입력한 기록을 확인했어요. 배분을 제안할게요",
        action: { type: "DAY_PRESET", preset: "WEEKEND", label: "주말 넉넉히" },
      },
    });
  });
  await page.route("**/api/v1/budget/day-weights", (route) => {
    changes++;
    expect(route.request().method()).toBe("PUT");
    expect(route.request().postDataJSON()).toEqual({ preset: "WEEKEND" });
    return route.fulfill({ json: {} });
  });
  await page.goto("/home");
  await page.getByRole("button", { name: "AI 메이트", exact: true }).click();
  await page.getByRole("button", { name: "다정한 친구", exact: true }).click();
  await page
    .getByLabel("AI 메이트에게 질문", { exact: true })
    .fill("주말 예산을 늘리고 싶어요");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByText(/^AI 메이트를 준비 중이에요/)).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByText("입력한 기록을 확인했어요. 배분을 제안할게요", {
      exact: true,
    }),
  ).toBeVisible();
  expect(changes).toBe(0);
  await page
    .getByRole("button", { name: "주말 넉넉히 적용 확인", exact: true })
    .click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(changes).toBe(0);
  await page
    .getByRole("button", { name: "주말 넉넉히 적용 확인", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 변경", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "배분 변경 완료", exact: true }),
  ).toBeDisabled();
  expect(changes).toBe(1);
  await page.reload();
  await expect(
    page.getByText("주말 예산을 늘리고 싶어요", { exact: true }),
  ).toHaveCount(0);
});

test("weekend home detail stops at Friday", async ({ page }) => {
  await session(page, "2026-10-31");
  await page.goto("/home");
  const request = page.waitForRequest((r) =>
    r
      .url()
      .includes("/transactions?from=2026-10-26&to=2026-10-30&type=EXPENSE"),
  );
  await page
    .getByRole("button", { name: "이번 주 일별 지출 내역 보기", exact: true })
    .click();
  await request;
  await expect(page.getByText("2026-10-30", { exact: true })).toBeVisible();
  await expect(
    page.getByText("2026-10-31 · 오늘", { exact: true }),
  ).toHaveCount(0);
});

test("an older server keeps basic screens usable and does not expose unsupported writes", async ({
  page,
}) => {
  await session(page);
  let writes = 0;
  page.on("request", (r) => {
    if (
      r.method() !== "GET" &&
      /scheduled-expenses|categories\/order|chat\/messages/.test(r.url())
    )
      writes++;
  });
  await page.route("**/api/v1/scheduled-expenses**", (route) =>
    route.fulfill({
      status: 404,
      json: { code: "NOT_FOUND", message: "not available" },
    }),
  );
  await page.goto("/categories");
  await expect(page.getByText("식비", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "식비 아래로 이동", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "삭제", exact: true }),
  ).toHaveCount(0);
  await page.goto("/transactions");
  await expect(
    page.getByRole("button", { name: "10월 30일", exact: true }),
  ).toBeDisabled();
  await page.goto("/chatbot");
  await expect(page.getByText(/^AI 메이트를 준비 중이에요/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "보내기", exact: true }),
  ).toHaveCount(0);
  await page.goto("/scheduled-expenses?date=2026-10-30");
  await expect(
    page.getByText(/^지출 예정 기능을 준비하고 있어요/),
  ).toBeVisible();
  await expect(page.getByLabel("예정 금액 (원)", { exact: true })).toHaveCount(
    0,
  );
  expect(writes).toBe(0);
});
