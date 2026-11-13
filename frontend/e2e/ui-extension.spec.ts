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
  // 카테고리는 거래 등록과 같은 아이콘 칸(첫 칸 기본 선택)이고, 여기서 카테고리를 추가하지 않는다
  await expect(
    page.getByRole("radio", { name: "식비", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("button", { name: /카테고리 추가|^\+ 추가$/ }),
  ).toHaveCount(0);
  await page.getByLabel("예정 금액 (원)", { exact: true }).fill("25000");
  await page.getByLabel("예정 지출 내용", { exact: true }).fill("생일 선물");
  await page
    .getByRole("button", { name: "예정 지출 등록", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "생일 선물 수정", exact: true }),
  ).toBeVisible();
  await page.reload();
  // 수정은 등록 화면과 분리된 상세 화면에서, 저장된 금액·내용을 그대로 채워 보여 준다
  await page
    .getByRole("button", { name: "생일 선물 수정", exact: true })
    .click();
  await expect(page).toHaveURL(/\/scheduled-expenses\/1\?date=2026-10-30$/);
  await expect(
    page.getByRole("textbox", { name: "예정 금액 (원)", exact: true }),
  ).toHaveValue("25,000");
  await expect(
    page.getByRole("textbox", { name: "예정 지출 내용", exact: true }),
  ).toHaveValue("생일 선물");
  await expect(
    page.getByRole("button", { name: "예정 지출 등록", exact: true }),
  ).toHaveCount(0);
  // 등록 화면(스택 뒤에 숨어 있음)의 날짜 제목·목록은 상세 화면에 보이지 않는다
  await expect(page.getByText("2026-10-30 지출 예정")).toBeHidden();
  await page
    .getByRole("textbox", { name: "예정 금액 (원)", exact: true })
    .fill("30000");
  await page
    .getByRole("button", { name: "예정 지출 수정", exact: true })
    .click();
  await expect(page).toHaveURL(/\/scheduled-expenses\?date=2026-10-30$/);
  await expect(
    page.getByText("30,000원 · 식비", { exact: true }),
  ).toBeVisible();
  // 등록한 예정은 내역 달력과 목록에 "예정"으로 보이지만 실제 지출 합계에는 들어가지 않는다
  await page.goto("/transactions");
  await expect(
    page.getByRole("button", {
      name: "10월 30일, 예정 지출 30,000원",
      exact: true,
    }),
  ).toBeVisible();
  const plannedRow = page
    .getByRole("button", {
      name: "예정, 생일 선물, 30,000원, 예정 지출 보기",
      exact: true,
    })
    .first();
  await expect(plannedRow).toBeVisible();
  await expect(page.getByText("30,000원", { exact: true })).toHaveCount(0);
  // 내역의 "예정" 줄은 그 예정의 상세 화면으로 간다(새 등록 화면이 아님)
  await plannedRow.click();
  await expect(page).toHaveURL(/\/scheduled-expenses\/1\?date=2026-10-30$/);
  await expect(
    page.getByRole("textbox", { name: "예정 금액 (원)", exact: true }),
  ).toHaveValue("30,000");
  await expect(
    page.getByRole("textbox", { name: "예정 지출 내용", exact: true }),
  ).toHaveValue("생일 선물");
  await page
    .getByRole("button", { name: "예정 지출 삭제", exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(plannedRow).toHaveCount(0);
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
    if (method === "PATCH") {
      const body = route.request().postDataJSON();
      categories = categories.map((c) => (c.id === 1 ? { ...c, ...body } : c));
      return route.fulfill({ json: categories.find((c) => c.id === 1) });
    }
    return route.fulfill({ json: categories });
  });
  await page.goto("/categories");
  const handle = page.getByRole("button", {
    name: "식비 순서 변경",
    exact: true,
  });
  const from = await handle.boundingBox();
  const to = await page
    .getByRole("button", { name: "교통 순서 변경", exact: true })
    .boundingBox();
  if (!from || !to) throw new Error("Category drag handles missing");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect.poll(() => categories[0].name).toBe("교통");
  await expect(handle).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /순서 변경$/ }).first(),
  ).toHaveAttribute("aria-label", "교통 순서 변경");
  await page.getByRole("button", { name: "식비 수정", exact: true }).click();
  await page
    .getByLabel("카테고리 이름 (20자 이내)", { exact: true })
    .fill("식사");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(page.getByText("식사", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "식사 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).last().click();
  await expect(page.getByText("식사", { exact: true })).toHaveCount(0);
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
  await page.getByRole("radio", { name: "다정한 친구", exact: true }).click();
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
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
  // 제안만 보여 주고, [확인]을 누르기 전에는 저장하지 않는다
  await expect(
    page.getByRole("button", { name: "그대로 둘게", exact: true }),
  ).toBeVisible();
  expect(changes).toBe(0);
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText(/주말 넉넉히.*바꿨어요/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인", exact: true }),
  ).toHaveCount(0);
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
