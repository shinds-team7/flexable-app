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
// Coins, collecting and costumes live in the shop: coin chip on the character home → coin history → 상점.
async function openShop(page: Page) {
  await page.getByRole("button", { name: /코인 내역 보기$/ }).click();
  await expect(page).toHaveURL(/\/coins\/history$/);
  await page.getByRole("button", { name: "상점", exact: true }).click();
  await expect(page).toHaveURL(/\/customize$/);
}
const checkedIn = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith("/api/v1/coins/check-in"));

async function expectVideoPlaying(page: Page) {
  // Hidden routes must release their players instead of retaining a second video.
  await expect(page.locator("video")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate(
          (v: HTMLVideoElement) =>
            v.readyState >= 2 && !v.paused && v.currentTime > 0.05,
        ),
    )
    .toBe(true);
}

test("signup gift, buy and apply a costume, the home shows it; a referral pays both people", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const inviter = email("inviter");
  await signup(page, inviter);
  await onboard(page);

  // First check-in: the gift modal once. The home itself keeps only the costume, no coin row.
  await closeReward(page, "업데이트 기념 200코인 선물", 200);
  // The default costume plays as a video that fits the 16:9 stage (web <video> must not keep its 1280px size).
  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  expect((await video.boundingBox())!.width).toBeLessThanOrEqual(390);
  const collect = page.getByRole("button", { name: "모으기", exact: true });
  await expect(collect).toHaveCount(0);
  await openShop(page);
  await balance(page, 200);
  await expect(page.getByText(/앱에서만 쓰는 코인/)).toHaveCount(0);
  // Local mode also lists inactive reserve costumes, so no empty slot is needed.
  await expect(
    page.getByLabel("준비 중인 코스튬", { exact: true }),
  ).toHaveCount(0);
  await expect(collect).toBeDisabled();
  // When the next coin would land after midnight (from 23:00 KST) the server sends no nextAt
  // and the shop shows no hint, so expect what the server actually answered (#157).
  const hint = page.getByText(/^다음 코인은 .+에 쌓여요$/);
  if ((await api(page, "GET", "/coins")).passive.nextAt)
    await expect(hint).toBeVisible();
  else await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page).toHaveURL(/\/coins\/history$/);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await Promise.all([checkedIn(page), page.reload()]);
  await expect(
    page.getByRole("heading", { name: "업데이트 기념 200코인 선물" }),
  ).toHaveCount(0);
  // Nothing has accrued within the first hour, and collecting then is not an error.
  expect((await api(page, "POST", "/coins/collect")).collected).toBe(0);

  // No purchase/equip needed: the default costume must resume after visiting the shop.
  for (let visit = 0; visit < 3; visit++) {
    await expectVideoPlaying(page);
    await openShop(page);
    await expect(
      page.getByLabel("광부 미리보기", { exact: true }),
    ).toBeVisible();
    await expectVideoPlaying(page);
    for (const name of ["직장냥이", "잭팟", "광부"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expectVideoPlaying(page);
    }
    // Back goes through the coin history the shop was opened from.
    await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
    await expect(page).toHaveURL(/\/coins\/history$/);
    await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expectVideoPlaying(page);
  }

  // Shop: select a coin costume, buy it, apply from the purchase modal.
  await openShop(page);
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
  const salary = page.getByRole("button", { name: "직장냥이", exact: true });
  // Converted costumes are unlocked by level and cannot be bought.
  await expect(salary).toContainText("Lv.2");
  await expect(page.getByText("잭팟", { exact: true })).toHaveCount(0);
  await salary.click();
  await expect(
    page.getByLabel("직장냥이 미리보기", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("직장냥이", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lv.2 달성 시 열림", exact: true }),
  ).toBeDisabled();
  // A real salary-cat video loads and plays, rather than the default fallback poster.
  await expect
    .poll(() =>
      page
        .getByLabel("직장냥이 미리보기", { exact: true })
        .locator("video")
        .evaluate(
          (v: HTMLVideoElement) =>
            v.readyState >= 2 && v.videoWidth === 1280 && v.currentTime > 0,
        ),
    )
    .toBe(true);
  // Inactive reserve products are available only in local mode for purchase coverage.
  await page.getByRole("button", { name: "선비냥이", exact: true }).click();
  await page
    .getByRole("button", { name: "200코인으로 구매", exact: true })
    .click();
  await expect(page.getByText("구매했어요", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("선비냥이 코스튬", { exact: true }),
  ).toBeVisible();
  // Buying does not apply it yet.
  expect((await api(page, "GET", "/coins")).equippedOutfitId).toBeNull();
  // The screen's own button now also reads 적용하기; the modal's is the last one.
  await page
    .getByRole("button", { name: "적용하기", exact: true })
    .last()
    .click();

  // Back on the home with the new costume; the shop shows the balance spent.
  await expect(page).toHaveURL(/\/home$/);
  const wallet = await api(page, "GET", "/coins");
  expect(wallet.balance).toBe(0);
  expect(wallet.equippedOutfitId).toBe("outfit-03");
  // The coin chip over the video opens the history, newest first with the amount in front.
  await page
    .getByRole("button", { name: "보유 코인 0개, 코인 내역 보기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/coins\/history$/);
  const rows = page.getByLabel(/^[+-]\d[\d,]* .+, \d\d:\d\d$/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveText(/^-200 코스튬 구매/);
  await expect(rows.nth(1)).toHaveText(/^\+200 가입 선물/);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openShop(page);
  await balance(page, 0);
  await expect(
    page.getByLabel("선비냥이 미리보기", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "선비냥이", exact: true }),
  ).toHaveText("🪙 200");
  await expect(
    page.getByRole("button", { name: "적용 중", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "유령냥이", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "200코인으로 구매", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/모자라요/)).toHaveCount(0);

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
  // My page keeps only the referral; the shop is reached from the coin history alone.
  await expect(page.getByRole("button", { name: "상점" })).toHaveCount(0);
  await expect(page.getByText(/앱에서만 쓰는 코인/)).toHaveCount(0);
  await page
    .getByLabel("친구에게 받은 추천 코드", { exact: true })
    .fill(` ${code.toLowerCase()} `);
  await page
    .getByRole("button", { name: "추천 코드 등록", exact: true })
    .click();
  await expect(
    page.getByText("코인 100개를 받았어요", { exact: true }),
  ).toBeVisible();
  expect((await api(page, "GET", "/coins")).balance).toBe(300);
  await expect(
    page.getByLabel("친구에게 받은 추천 코드", { exact: true }),
  ).toHaveCount(0);
  await logout(page);

  // The code owner gets a modal at the next check-in.
  await login(page, inviter);
  await expect(page).toHaveURL(/\/home$/);
  await closeReward(page, "추천 코드가 사용됐어요", 100);
  await openShop(page);
  await balance(page, 100);
  await page.goto("/my");
  await expect(page.getByText(/\(지금까지 1명\)/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("level three caps the home gauge and a costume refund is acknowledged once", async ({
  page,
}) => {
  await signup(page, email("refund"));
  await onboard(page);
  await closeReward(page, "업데이트 기념 200코인 선물", 200);
  const today = await api(page, "GET", "/budget/today");
  const wallet = await api(page, "GET", "/coins");
  await page.route("**/api/v1/budget/today", (route) =>
    route.fulfill({
      json: { ...today, characterPoints: 200, characterDelta: 0 },
    }),
  );
  let pending = true;
  await page.route("**/api/v1/coins/check-in", (route) =>
    route.fulfill({
      json: {
        wallet: { ...wallet, balance: 400 },
        rewards: pending
          ? [
              {
                id: 987654,
                reason: "REFUND",
                amount: 200,
                refDate: null,
                createdAt: new Date().toISOString(),
              },
            ]
          : [],
      },
    }),
  );
  await page.route("**/api/v1/coins/rewards/ack", (route) => {
    expect(route.request().postDataJSON()).toEqual({ ids: [987654] });
    pending = false;
    return route.fulfill({ status: 204 });
  });
  await Promise.all([checkedIn(page), page.reload()]);
  await expect(page.getByText(/코스튬은 계속 쓸 수 있어요/)).toBeVisible();
  await closeReward(page, "코스튬 구매 코인을 돌려드려요", 200);
  await expect.poll(() => pending).toBe(false);
  const gauge = page.getByRole("progressbar");
  await expect(gauge).toHaveAccessibleName(/최고 단계/);
  await expect(gauge).toContainText("최고 단계");
  await expect(gauge).toContainText("Lv.3");
  await expect(gauge).not.toContainText("%");
  await expect(
    page.getByText("광부에서 시작! 예산을 지키면 조금씩 올라가요", {
      exact: true,
    }),
  ).toHaveCount(0);
  await Promise.all([checkedIn(page), page.reload()]);
  await expect(
    page.getByRole("heading", { name: "코스튬 구매 코인을 돌려드려요" }),
  ).toHaveCount(0);
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
  // Production lists only the miner among level costumes; two locked slots fill the row of three.
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
            id: "outfit-01",
            name: "잭팟",
            price: 200,
            unlockLevel: null,
            owned: false,
            equipped: false,
          },
        ],
      },
    }),
  );
  // The shop reads the wallet again on its own.
  await page.route("**/api/v1/coins", (route) =>
    route.fulfill({
      json: { balance: 200, passive: passive(3, 0), equippedOutfitId: null },
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
  await Promise.all([checkedIn(page), page.reload()]);
  await openShop(page);
  await balance(page, 200);
  await expect(
    page.getByLabel("준비 중인 코스튬", { exact: true }),
  ).toHaveCount(2);
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
