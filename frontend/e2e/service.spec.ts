/// <reference types="node" />
import { test, expect, type Page } from "@playwright/test";
const apiBase = "http://localhost:8080/api/v1";
const password = "Testpass1234";
const email = () =>
  `frontend.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
async function signup(page: Page, address: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "이메일로 시작하기", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
  await page
    .getByRole("checkbox", { name: "필수 서비스 이용약관 동의" })
    .click();
  await page
    .getByRole("checkbox", { name: "필수 개인정보 수집·이용 동의" })
    .click();
  await page.getByRole("button", { name: "가입하기", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}
async function token(page: Page) {
  return page.evaluate(() => localStorage.getItem("flexable.service.token")!);
}
async function snapshot(page: Page, path: string) {
  const auth = await token(page);
  const response = await page.request.get(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function login(page: Page, address: string) {
  await page
    .getByRole("button", { name: "이미 계정이 있어요", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

test("real service lifecycle, retry idempotency, edits, logout and deletion", async ({
  page,
}) => {
  const address = email();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let budgetWrites = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().endsWith("/budget/settings"))
      budgetWrites++;
  });
  await signup(page, address);
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("생활비 잔액 (원)", { exact: true }).fill("1000000");
  // A refresh must recover the in-progress draft, with no server write yet.
  await page.reload();
  await expect(page.getByLabel("생활비 잔액 (원)", { exact: true })).toHaveValue(
    "1,000,000",
  );
  expect(budgetWrites).toBe(0);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("매달 수입일 (1~31)", { exact: true }).fill("25");
  await page.getByLabel("예정 수입액 (원)", { exact: true }).fill("2400000");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page
    .getByRole("button", { name: "+ 보호할 돈 추가", exact: true })
    .click();
  await page.getByLabel("이름", { exact: true }).fill("비상금");
  await page.getByLabel("금액 (원)", { exact: true }).fill("50000");
  let droppedUserLookup = false;
  await page.route("**/api/v1/me", (route) => {
    if (route.request().method() === "GET" && !droppedUserLookup) {
      droppedUserLookup = true;
      return route.abort("failed");
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText(/연결이 불안정해요/)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\/protect$/);
  expect(budgetWrites).toBe(1);
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/done$/);
  expect(budgetWrites).toBe(1);
  await page.getByRole("button", { name: "홈으로", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByText("아직 기록한 거래가 없어요", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/service-home.png",
    fullPage: true,
  });
  const before = await snapshot(page, "/budget/today");
  await page
    .getByRole("button", { name: "+ 거래 직접 기록", exact: true })
    .click();
  await page.getByLabel("금액 (원)", { exact: true }).fill("1000000000000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByText("금액은 1원 이상, 1조 미만으로 입력해 주세요", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("금액 (원)", { exact: true })).toHaveValue(
    "1,000,000,000,000",
  );
  await page.getByLabel("금액 (원)", { exact: true }).fill("8500");
  await page
    .getByLabel("내용 (40자 이내)", { exact: true })
    .fill("테스트 점심");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page
    .getByLabel("카테고리 이름 (20자 이내)", { exact: true })
    .fill("직접 만든 분류");
  await page.getByRole("button", { name: "추가하기", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "직접 만든 분류", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  const keys: string[] = [];
  let dropped = false;
  await page.route("**/api/v1/transactions", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (!dropped) {
      dropped = true;
      const real = await route.fetch();
      expect(real.status()).toBe(201);
      return route.abort("failed");
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByText(
      "저장 여부를 확인하지 못했어요. 같은 내용으로 다시 확인할게요",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("내용 (40자 이내)", { exact: true }),
  ).toHaveValue("테스트 점심");
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const after = await snapshot(page, "/budget/today");
  expect(after.estimatedBalance).toBe(before.estimatedBalance - 8500);
  await expect(
    page.getByLabel(
      `오늘 쓸 수 있는 돈 ${after.todayAvailable.toLocaleString("ko-KR")}원`,
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "내역", exact: true }).click();
  await expect(page.getByText("테스트 점심", { exact: true })).toBeVisible();
  // Adding from the 전체 filter keeps the expense default.
  await expect(
    page.getByRole("tab", { name: "전체", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "+ 거래 직접 기록", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "지출", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  // Adding from the 수입 filter must open (and save) as income without touching the form's segment.
  await page.getByRole("tab", { name: "수입", exact: true }).click();
  await page
    .getByRole("button", { name: "+ 거래 직접 기록", exact: true })
    .click();
  await expect(page).toHaveURL(/\/transactions\/new\?type=INCOME$/);
  await expect(
    page.getByRole("tab", { name: "수입", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("금액 (원)", { exact: true }).fill("50000");
  await page.getByRole("radio", { name: "급여", exact: true }).click();
  await page
    .getByLabel("내용 (40자 이내)", { exact: true })
    .fill("테스트 수입");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText("테스트 수입", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /테스트 수입, 50,000원, 상세 보기/ })
      .getByText("+50,000원", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "분석", exact: true }).click();
  await expect(
    page.getByText("기록한 지출 1건", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("수입 50,000원", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "이번 달", exact: true }).click();
  await expect(
    page.getByText("기록한 지출 1건", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "내역", exact: true }).click();
  // The list is still filtered to 수입 from the step above.
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.getByRole("button", { name: /테스트 점심, .*상세 보기/ }).click();
  await page.getByLabel("금액 (원)", { exact: true }).fill("7000");
  await page
    .getByLabel("메모 (200자 이내, 선택)", { exact: true })
    .fill("수정 메모");
  // Adding a category while editing must preserve unsaved amounts and memo.
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page
    .getByLabel("카테고리 이름 (20자 이내)", { exact: true })
    .fill("수정 중 추가");
  await page.getByRole("button", { name: "추가하기", exact: true }).click();
  await expect(page.getByLabel("금액 (원)", { exact: true })).toHaveValue(
    "7,000",
  );
  await expect(
    page.getByLabel("메모 (200자 이내, 선택)", { exact: true }),
  ).toHaveValue("수정 메모");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole("button", { name: /테스트 점심, 7,000원/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "카테고리 관리", exact: true })
    .click();
  const custom = page.getByText("수정 중 추가", { exact: true }).locator("..");
  await custom
    .locator("..")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByText("이 카테고리의 거래는 '기타'로 옮겨져요", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).last().click();
  await expect(page.getByText("수정 중 추가", { exact: true })).toHaveCount(0);
  await page.goto("/transactions");
  await page.getByRole("button", { name: /테스트 점심, 7,000원/ }).click();
  await expect(
    page.getByRole("radio", { name: "기타", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.route("**/api/v1/transactions/*", (route) =>
    route.request().method() === "DELETE"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "거래 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText(/연결이 불안정해요/)).toBeVisible();
  await expect(page.getByLabel("금액 (원)", { exact: true })).toHaveValue(
    "7,000",
  );
  await page.unroute("**/api/v1/transactions/*");
  await page
    .getByRole("button", { name: "거래 삭제 다시 시도", exact: true })
    .click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText("테스트 점심", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page
    .getByRole("button", { name: "로그아웃", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/8081\/$/);
  await login(page, address);
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await page
    .getByLabel("삭제 확인용 비밀번호", { exact: true })
    .fill("Wrongpass123");
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(
    page.getByText("비밀번호가 맞지 않아요. 다시 확인해 주세요", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("삭제 확인용 비밀번호", { exact: true }),
  ).toHaveValue("Wrongpass123");
  await page.getByLabel("삭제 확인용 비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(page).toHaveURL(/8081\/$/);
  await login(page, address);
  await expect(
    page.getByText("이메일 또는 비밀번호가 맞지 않아요", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveValue("");
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/lifecycle-final.png",
    fullPage: true,
  });
});

test("re-entering the balance in settings does not subtract earlier spending again", async ({
  page,
}) => {
  await signup(page, email());
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("생활비 잔액 (원)", { exact: true }).fill("1000000");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.getByRole("button", { name: "홈으로", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const auth = await token(page);
  const categories = await (
    await page.request.get(`${apiBase}/categories?type=EXPENSE`, {
      headers: { Authorization: `Bearer ${auth}` },
    })
  ).json();
  const spent = await page.request.post(`${apiBase}/transactions`, {
    headers: { Authorization: `Bearer ${auth}` },
    data: {
      type: "EXPENSE",
      amount: 100000,
      categoryId: categories[0].id,
      title: "장보기",
    },
  });
  expect(spent.status()).toBe(201);
  expect((await snapshot(page, "/budget/today")).estimatedBalance).toBe(900000);
  // The bank now shows 900,000. Re-enter only the balance, without touching the time.
  await page.getByRole("tab", { name: "마이", exact: true }).click();
  await page
    .getByRole("button", { name: "예산 설정 수정", exact: true })
    .click();
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  // The first onboarding screen stays mounted (hidden) in the web stack; roles skip hidden nodes.
  const balance = page.getByRole("textbox", {
    name: "생활비 잔액 (원)",
    exact: true,
  });
  await expect(balance).toHaveValue("1,000,000");
  await balance.fill("900000");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/done$/);
  expect((await snapshot(page, "/budget/today")).estimatedBalance).toBe(900000);
});

test("public deletion without budget setup and offline failure preserves credentials", async ({
  page,
}) => {
  const address = email();
  await signup(page, address);
  await page.goto("/delete-account");
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByLabel("삭제 확인용 비밀번호", { exact: true }).fill(password);
  await page.route("**/api/v1/me", (route) =>
    route.request().method() === "DELETE"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(page.getByText(/연결이 불안정해요/)).toBeVisible();
  await expect(
    page.getByLabel("삭제 확인용 비밀번호", { exact: true }),
  ).toHaveValue(password);
  expect(await token(page)).toBeTruthy();
  await page.unroute("**/api/v1/me");
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(
    page.getByText("계정과 모든 기록을 삭제했어요", { exact: true }),
  ).toBeVisible();
  expect(await token(page)).toBeNull();
  const denied = await page.request.post(`${apiBase}/auth/login`, {
    data: { email: address, password },
  });
  expect(denied.status()).toBe(401);
  expect((await denied.json()).code).toBe("INVALID_CREDENTIALS");
});

test("expired token returns to start; public routes and demo remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("flexable.service.token", "expired-test-token"),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "이미 계정이 있어요", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("다시 로그인해 주세요", { exact: true }),
  ).toBeVisible();
  expect(await token(page)).toBeNull();
  await page.goto("/privacy");
  await expect(
    page.getByText("- 시행일: 2026년 10월 14일", { exact: true }),
  ).toBeVisible();
  await page.goto("/support");
  await expect(page.getByText("앱 버전 1.0.0", { exact: true })).toBeVisible();
  await page.goto("/demo");
  await expect(
    page.getByText("시연용 · 예시 데이터 · v1.1.0", { exact: true }),
  ).toBeVisible();
});

test("approved legal copy and public terms link preserve signup input", async ({
  page,
}) => {
  await page.goto("/auth/signup");
  await expect(
    page.getByText("만 14세 이상만 가입할 수 있어요", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("이메일", { exact: true }).fill("draft@example.com");
  await page
    .getByRole("button", { name: "서비스 이용약관 보기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(
    page.getByText("이 약관은 2026년 10월 13일부터 시행합니다.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
    "draft@example.com",
  );
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: "test-results/signup-360.png",
    fullPage: true,
  });
  const fs = await import("node:fs/promises");
  for (const [route, file] of [
    ["/privacy", "privacy-policy.md"],
    ["/terms", "terms.md"],
  ] as const) {
    const source = await fs.readFile(`../docs/play-store/${file}`, "utf8");
    const body = source.replace(/\r/g, "").split("\n---\n")[1].trim();
    await page.goto(route);
    const text = await page.locator("body").innerText();
    for (const line of body
      .split("\n")
      .filter((x) => x.trim() && !/^\|[-| ]+\|$/.test(x))) {
      if (line.startsWith("|")) {
        for (const cell of line.split("|").slice(1, -1))
          expect(text).toContain(cell.trim());
      } else
        expect(text).toContain(line.replace(/^## /, "").replace(/\*\*/g, ""));
    }
  }
});
