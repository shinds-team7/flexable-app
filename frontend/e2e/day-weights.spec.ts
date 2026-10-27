/// <reference types="node" />
import { test, expect, type Page } from "@playwright/test";
const apiBase = "http://localhost:8080/api/v1";
const password = "Testpass1234";
const email = () =>
  `frontend.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
async function signupAndOnboard(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email());
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
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("생활비 잔액 (원)", { exact: true }).fill("1000000");
  // 잔액 다음 단계: 수입 → 고정지출 → 카드 → 모아둔 돈 → 매달 저축할 돈
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.getByRole("button", { name: "홈으로", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("heading", { name: "업데이트 기념 200코인 선물" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
}
async function today(page: Page) {
  const auth = await page.evaluate(() =>
    localStorage.getItem("flexable.service.token")!,
  );
  const response = await page.request.get(`${apiBase}/budget/today`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("weekday allocation: a new user cannot use the record preset, picks a preset, drags a bar and the home follows the server", async ({
  page,
}) => {
  await signupAndOnboard(page);
  await expect(page.getByText("기본 배분", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "요일별 배분 바꾸기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/budget\/day-weights$/);

  // No recorded spending yet: the record preset says what is missing and cannot be picked.
  await expect(
    page.getByText(/지출을 기록한 날이 7일 더 있으면 쓸 수 있어요/),
  ).toBeVisible();
  const record = page.getByRole("radio", { name: "내 기록 기준", exact: true });
  await expect(record).toBeDisabled();
  await record.click({ force: true });
  await expect(
    page.getByRole("radio", { name: "기본 배분", exact: true }),
  ).toBeChecked();
  const save = page.getByRole("button", { name: "저장", exact: true });
  await expect(save).toBeDisabled();

  await page.getByRole("radio", { name: "주말 넉넉히", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "주말 넉넉히", exact: true }),
  ).toBeChecked();

  // Drag Wednesday's bar to the top: the weights become a custom allocation.
  const wednesday = page.getByRole("slider", { name: "수요일 비중" });
  const box = (await wednesday.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("직접 조정", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("직접 조정", { exact: true })).toBeVisible();
  const s = await today(page);
  expect(s.dayPreset).toBe("CUSTOM");
  const index = (new Date(s.date + "T12:00:00").getDay() + 6) % 7;
  expect(s.dailyBudget).toBe(s.dayBudgets[index]);
  // Wednesday got the largest weight, so it has the largest daily budget of the week.
  expect(s.dayBudgets[2]).toBe(Math.max(...s.dayBudgets));
});
