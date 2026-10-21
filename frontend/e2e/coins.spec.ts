/// <reference types="node" />
import { expect, test, type Page } from "@playwright/test";

// Coins and costumes against the real local server (docs/coin-plan.md). Shop items are visible
// here because the local profile sets app.outfits.show-inactive=true.
const apiBase = "http://localhost:8080/api/v1";
const password = "Testpass1234";
const email = (tag: string) =>
  `coin.${tag}.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;

async function signup(page: Page, address: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
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
async function onboard(page: Page) {
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("생활비 잔액 (원)", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("매달 수입일 (1~31)", { exact: true }).fill("25");
  await page.getByLabel("예정 수입액 (원)", { exact: true }).fill("2400000");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/done$/);
  await page.getByRole("button", { name: "홈으로", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function login(page: Page, address: string) {
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
async function logout(page: Page) {
  await page.goto("/my");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page
    .getByRole("button", { name: "로그아웃", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/8081\/$/);
}
async function api(page: Page, method: "GET" | "POST", path: string) {
  const auth = await page.evaluate(() =>
    localStorage.getItem("flexable.service.token")!,
  );
  const response = await page.request.fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}` },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function closeReward(page: Page, title: string, amount: number) {
  const dialog = page.getByRole("heading", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByText(`+${amount}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
const balance = (page: Page, n: number) =>
  expect(page.getByLabel(`코인 ${n}개`, { exact: true })).toBeVisible();

test("signup gift, buy and apply a costume, the home shows it; a referral pays both people", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const inviter = email("inviter");
  await signup(page, inviter);
  await onboard(page);

  // First check-in: the gift modal once, then the coin row.
  await closeReward(page, "업데이트 기념 200코인 선물", 200);
  await balance(page, 200);
  // The default costume plays as a video that fits the 16:9 stage (web <video> must not keep its 1280px size).
  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  expect((await video.boundingBox())!.width).toBeLessThanOrEqual(390);
  const collect = page.getByRole("button", { name: "모으기", exact: true });
  await expect(collect).toBeDisabled();
  await expect(page.getByText(/^다음 코인은 .+에 쌓여요$/)).toBeVisible();
  await page.reload();
  await balance(page, 200);
  await expect(
    page.getByRole("heading", { name: "업데이트 기념 200코인 선물" }),
  ).toHaveCount(0);
  // Nothing has accrued within the first hour, and collecting then is not an error.
  expect((await api(page, "POST", "/coins/collect")).collected).toBe(0);

  // Customize: select a shop item, buy it, apply from the purchase modal.
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page).toHaveURL(/\/customize$/);
  await expect(page.getByLabel("광부 미리보기", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "적용 중", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "왕", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lv.5 달성 시 열림", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "잭팟", exact: true }).click();
  await expect(page.getByLabel("잭팟 미리보기", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "200코인으로 구매", exact: true })
    .click();
  await expect(page.getByText("구매했어요", { exact: true })).toBeVisible();
  await expect(page.getByLabel("잭팟 코스튬", { exact: true })).toBeVisible();
  // Buying does not apply it yet.
  expect((await api(page, "GET", "/coins")).equippedOutfitId).toBeNull();
  // The screen's own button now also reads 적용하기; the modal's is the last one.
  await page
    .getByRole("button", { name: "적용하기", exact: true })
    .last()
    .click();

  // The home reloads the wallet on return: new costume, balance spent.
  await expect(page).toHaveURL(/\/home$/);
  await balance(page, 0);
  const wallet = await api(page, "GET", "/coins");
  expect(wallet.balance).toBe(0);
  expect(wallet.equippedOutfitId).toBe("outfit-01");
  await page.getByRole("button", { name: "꾸미기", exact: true }).click();
  await expect(page.getByLabel("잭팟 미리보기", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "적용 중", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "상품 02", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "200코인으로 구매", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("코인이 200개 모자라요", { exact: true }),
  ).toBeVisible();

  // Referral: the invitee enters the code on My page.
  const { code } = await api(page, "GET", "/referrals/me");
  await page.goto("/my");
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  // Own code is rejected.
  await page.getByLabel("친구에게 받은 추천 코드", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "추천 코드 등록", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await logout(page);

  await signup(page, email("invitee"));
  await onboard(page);
  await closeReward(page, "업데이트 기념 200코인 선물", 200);
  await page.goto("/my");
  await expect(
    page.getByText("앱에서만 쓰는 코인 200개", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("친구에게 받은 추천 코드", { exact: true })
    .fill(` ${code.toLowerCase()} `);
  await page
    .getByRole("button", { name: "추천 코드 등록", exact: true })
    .click();
  await expect(
    page.getByText("코인 100개를 받았어요", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("앱에서만 쓰는 코인 300개", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("친구에게 받은 추천 코드", { exact: true }),
  ).toHaveCount(0);
  await logout(page);

  // The code owner gets a modal at the next check-in.
  await login(page, inviter);
  await expect(page).toHaveURL(/\/home$/);
  await closeReward(page, "추천 코드가 사용됐어요", 100);
  await balance(page, 100);
  await page.goto("/my");
  await expect(page.getByText(/\(지금까지 1명\)/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("collect takes the coins that accrued since the first check-in (accrual mocked)", async ({
  page,
}) => {
  await signup(page, email("collect"));
  await onboard(page);
  await closeReward(page, "업데이트 기념 200코인 선물", 200);
  // Accrual needs real hours, so only the server's answers are mocked here.
  const passive = (collectable: number, collectedToday: number) => ({
    collectable,
    collectedToday,
    dailyLimit: 10,
    nextAt: "2026-10-21T15:12:00+09:00",
  });
  await page.route("**/api/v1/coins/check-in", (route) =>
    route.fulfill({
      json: {
        wallet: {
          balance: 200,
          passive: passive(3, 0),
          equippedOutfitId: null,
        },
        rewards: [],
      },
    }),
  );
  let collects = 0;
  await page.route("**/api/v1/coins/collect", (route) => {
    collects++;
    return route.fulfill({
      json: {
        collected: 3,
        wallet: {
          balance: 203,
          passive: passive(0, 3),
          equippedOutfitId: null,
        },
      },
    });
  });
  await page.reload();
  await balance(page, 200);
  await page.getByRole("button", { name: "모으기 +3", exact: true }).click();
  await balance(page, 203);
  await expect(
    page.getByRole("button", { name: "모으기", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/^다음 코인은 오후 3:12에 쌓여요$/),
  ).toBeVisible();
  expect(collects).toBe(1);
});
