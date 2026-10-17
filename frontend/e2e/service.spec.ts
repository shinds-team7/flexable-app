/// <reference types="node" />
import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
const apiBase = "http://localhost:8080/api/v1";
const password = "Testpass1234";
const email = () =>
  `frontend.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
async function signup(page: Page, address: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/signup$/);
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
    .getByRole("button", { name: "이메일로 로그인", exact: true })
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

test("changing input after a failed post-save step re-saves before finishing", async ({
  page,
}) => {
  const bodies: { protectedItems: { amount: number }[] }[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().endsWith("/budget/settings"))
      bodies.push(r.postDataJSON());
  });
  await signup(page, email());
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("생활비 잔액 (원)", { exact: true }).fill("1000000");
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
  await page.getByLabel("금액 (원)", { exact: true }).fill("1000");
  let droppedUserLookup = false;
  await page.route("**/api/v1/me", (route) => {
    if (route.request().method() === "GET" && !droppedUserLookup) {
      droppedUserLookup = true;
      return route.abort("failed");
    }
    return route.continue();
  });
  // The PUT succeeds but the follow-up user refresh fails, leaving the form editable.
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByText(/연결이 불안정해요/)).toBeVisible();
  expect(bodies.map((b) => b.protectedItems[0].amount)).toEqual([1000]);
  await page.getByLabel("금액 (원)", { exact: true }).fill("9000");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/done$/);
  expect(bodies.map((b) => b.protectedItems[0].amount)).toEqual([1000, 9000]);
  const settings = await snapshot(page, "/budget/settings");
  expect(settings.protectedItems[0].amount).toBe(9000);
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
  // 첫 화면이 저장소를 다 읽은 뒤에 토큰을 넣는다. 먼저 넣으면 첫 페이지가 이 토큰으로 /me를 보내
  // 401을 받고 토큰을 지운 채 새로고침돼, 다시 연 페이지에는 만료 안내가 뜨지 않는다(CI 10-16).
  await expect(
    page.getByRole("button", { name: "카카오 로그인", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("flexable.service.token", "expired-test-token"),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "카카오 로그인", exact: true }),
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
  await expect(page.getByText("앱 버전 1.1.0", { exact: true })).toBeVisible();
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
    // Read the page only after it has rendered (an empty body was read once right after load).
    await expect(
      page.getByText(/^텅장관리 (개인정보처리방침|서비스 이용약관)$/),
    ).toBeVisible();
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

test("start screen offers kakao, google and email with policy links at the bottom", async ({
  page,
}) => {
  await page.goto("/");
  const buttons = [
    "카카오 로그인",
    "Google 계정으로 로그인",
    "이메일로 로그인",
  ].map((name) => page.getByRole("button", { name, exact: true }));
  for (const button of buttons) await expect(button).toBeVisible();
  await expect(
    page.getByRole("button", { name: "이미 계정이 있어요", exact: true }),
  ).toHaveCount(0);
  const boxes = await Promise.all(buttons.map((b) => b.boundingBox()));
  for (const box of boxes) {
    expect(box!.width).toBeCloseTo(boxes[0]!.width, 0);
    expect(box!.height).toBeGreaterThanOrEqual(54);
  }
  expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
  expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
  await expect(
    page.getByText(
      "계속하면 이용약관과 개인정보처리방침에 동의하는 것으로 봐요. 만 14세 이상만 이용할 수 있어요.",
      { exact: true },
    ),
  ).toBeVisible();
  const terms = page.getByRole("link", { name: "이용약관", exact: true });
  const privacy = page.getByRole("link", {
    name: "개인정보처리방침",
    exact: true,
  });
  const termsBox = (await terms.boundingBox())!;
  const privacyBox = (await privacy.boundingBox())!;
  // One small line below the buttons, each still easy to tap.
  expect(Math.abs(termsBox.y - privacyBox.y)).toBeLessThan(2);
  expect(termsBox.y).toBeGreaterThan(boxes[2]!.y + boxes[2]!.height);
  expect(privacyBox.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "test-results/start-390.png", fullPage: true });
  await privacy.click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("email login keeps password help and signup on one line under the login button", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  const submit = (await page
    .getByRole("button", { name: "로그인", exact: true })
    .boundingBox())!;
  const forgot = page.getByRole("button", { name: "비밀번호 찾기", exact: true });
  const join = page.getByRole("button", { name: "회원가입", exact: true });
  const f = (await forgot.boundingBox())!;
  const j = (await join.boundingBox())!;
  expect(Math.abs(f.y - j.y)).toBeLessThan(2);
  expect(f.x + f.width).toBeLessThan(j.x);
  expect(f.x).toBeLessThan(submit.x + 8);
  expect(j.x + j.width).toBeGreaterThan(submit.x + submit.width - 8);
  expect(f.y).toBeGreaterThanOrEqual(submit.y + submit.height - 1);
  expect(f.y).toBeLessThan(submit.y + submit.height + 24);
  expect(f.height).toBeGreaterThanOrEqual(44);
  expect(j.height).toBeGreaterThanOrEqual(44);
  await forgot.click();
  await expect(page.getByText(/비밀번호 재설정은 준비 중이에요/)).toBeVisible();
  await join.click();
  await expect(page).toHaveURL(/\/auth\/signup$/);
});

test("social login tells the user when the server has that method turned off", async ({
  page,
}) => {
  // The local backend has no Kakao or Google keys, so the provider list is empty.
  await page.goto("/");
  await page
    .getByRole("button", { name: "카카오 로그인", exact: true })
    .click();
  await expect(
    page.getByText("지금은 이 로그인 방법을 쓸 수 없어요", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/8081\/$/);
  await expect(
    page.getByRole("button", { name: "Google 계정으로 로그인", exact: true }),
  ).toBeEnabled();
});

// Client side only: the exchange answer is mocked here. The real server round trip (state, code,
// verifier check, user creation) is covered by the backend OAuthFlowTest.
test("social login binds the code to this tab's verifier and signs in once (exchange answer mocked)", async ({
  page,
}) => {
  const signed = await page.request.post(`${apiBase}/auth/signup`, {
    data: { email: email(), password, agreeTerms: true, agreePrivacy: true },
  });
  expect(signed.ok()).toBeTruthy();
  const auth = await signed.json();
  await page.route("**/api/v1/auth/oauth/providers", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, json: { providers: ["kakao", "google"] } });
  });
  // Stand in for the server's start page (which would forward to Kakao).
  await page.route("**/api/v1/auth/oauth/kakao/start**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>kakao</p>" }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "카카오 로그인", exact: true })
    .click();
  await page.waitForURL(/\/api\/v1\/auth\/oauth\/kakao\/start\?/);
  const start = new URL(page.url());
  expect(start.searchParams.get("redirectUri")).toBe(
    "http://localhost:8081/oauth/callback",
  );
  const challenge = start.searchParams.get("codeChallenge")!;
  expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.goto("/privacy");
  // Kept per tab, so it survives the full-page trip but another tab cannot overwrite it.
  const verifier = await page.evaluate(() =>
    sessionStorage.getItem("flexable.service.oauth.verifier"),
  );
  expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(createHash("sha256").update(verifier!).digest("base64url")).toBe(
    challenge,
  );
  // Stand in for the provider and the server: they would now redirect back with a one-time code,
  // and the mocked exchange answers with a real session of a test account.
  const exchanged: unknown[] = [];
  await page.route("**/api/v1/auth/oauth/exchange", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    exchanged.push(route.request().postDataJSON());
    const response = await route.fetch();
    await route.fulfill({ response, status: 200, json: auth });
  });
  await page.goto("/oauth/callback?code=test-code");
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(exchanged).toEqual([{ code: "test-code", codeVerifier: verifier }]);
  expect(await token(page)).toBe(auth.accessToken);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("flexable.service.oauth.verifier"),
    ),
  ).toBeNull();
});

test("social login errors explain what happened and lead back to the start", async ({
  page,
}) => {
  await page.goto("/oauth/callback?error=email_in_use");
  await expect(
    page.getByText(
      "이미 가입된 이메일이에요. 처음 가입한 방법으로 로그인해 주세요",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/oauth/callback?error=cancelled");
  await expect(
    page.getByText("로그인을 취소했어요", { exact: true }),
  ).toBeVisible();
  // A code the server never issued is rejected even with a verifier present.
  await page.evaluate(() =>
    sessionStorage.setItem("flexable.service.oauth.verifier", "a".repeat(43)),
  );
  await page.goto("/oauth/callback?code=unknown-code");
  await expect(
    page.getByText("로그인하지 못했어요. 다시 시도해 주세요", { exact: true }),
  ).toBeVisible();
  expect(await token(page)).toBeNull();
  await page.getByRole("button", { name: "처음으로", exact: true }).click();
  await expect(page).toHaveURL(/8081\/$/);
  await expect(
    page.getByRole("button", { name: "카카오 로그인", exact: true }),
  ).toBeVisible();
});

test("social login reports connection and server problems without opening the login page", async ({
  page,
}) => {
  let opened = false;
  await page.route("**/api/v1/auth/oauth/*/start**", (route) => {
    opened = true;
    return route.abort();
  });
  await page.route("**/api/v1/auth/oauth/providers", (route) =>
    route.request().method() === "GET"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.goto("/");
  const kakao = page.getByRole("button", {
    name: "카카오 로그인",
    exact: true,
  });
  await kakao.click();
  await expect(
    page.getByText("연결이 불안정해요. 연결 후 다시 시도해 주세요", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(kakao).toBeEnabled();
  await page.unroute("**/api/v1/auth/oauth/providers");
  await page.route("**/api/v1/auth/oauth/providers", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      status: 500,
      json: { code: "INTERNAL_ERROR", message: "일시적인 오류가 발생했어요" },
    });
  });
  await page
    .getByRole("button", { name: "Google 계정으로 로그인", exact: true })
    .click();
  await expect(
    page.getByText("불러오지 못했어요. 잠시 후 다시 시도해 주세요", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/8081\/$/);
  expect(opened).toBe(false);
});

// The account is a real email account; /me is mocked to look like a Kakao account without a password.
test("a kakao account without a password sees its login method and deletes with the confirm word", async ({
  page,
}) => {
  const signed = await page.request.post(`${apiBase}/auth/signup`, {
    data: { email: email(), password, agreeTerms: true, agreePrivacy: true },
  });
  expect(signed.ok()).toBeTruthy();
  const auth = await signed.json();
  const budget = await page.request.put(`${apiBase}/budget/settings`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    data: {
      balance: 1000000,
      payday: 25,
      incomeAmount: 0,
      cardUnpaid: 0,
      fixedExpenses: [],
      protectedItems: [],
    },
  });
  expect(budget.ok()).toBeTruthy();
  let deleteBody: unknown;
  await page.route("**/api/v1/me", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      const response = await route.fetch();
      return route.fulfill({
        response,
        json: {
          ...(await response.json()),
          email: null,
          provider: "kakao",
          hasPassword: false,
        },
      });
    }
    if (method === "DELETE") {
      // The real account has a password, so answer for the server instead of deleting it.
      deleteBody = route.request().postDataJSON();
      return route.fulfill({
        status: 204,
        headers: { "Access-Control-Allow-Origin": "http://localhost:8081" },
      });
    }
    return route.continue();
  });
  await page.goto("/privacy");
  await page.evaluate(
    (value) => localStorage.setItem("flexable.service.token", value),
    auth.accessToken,
  );
  await page.goto("/my");
  await expect(
    page.getByText("카카오 계정으로 로그인 중", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계정 삭제", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "삭제 확인용 비밀번호", exact: true }),
  ).toHaveCount(0);
  const confirm = page.getByRole("textbox", {
    name: "확인을 위해 '탈퇴'를 입력해 주세요",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  const remove = page.getByRole("button", { name: "계정 삭제", exact: true });
  await expect(remove).toBeDisabled();
  await confirm.fill("탈퇴");
  await remove.click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await expect(page).toHaveURL(/8081\/$/);
  expect(deleteBody).toEqual({ confirm: "탈퇴" });
  expect(await token(page)).toBeNull();
});
