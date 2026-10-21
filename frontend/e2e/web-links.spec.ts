import { expect, test, type Page } from "@playwright/test";

// UI contract tests: no real account, service key, or web backend is needed.
async function session(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("flexable.service.token", "web-link-ui-test");
  });
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        id: 1,
        email: "ui@example.com",
        provider: "email",
        onboarded: true,
        createdAt: "2026-10-20T00:00:00+09:00",
      },
    }),
  );
  // My page also asks for coins; answer like a server without them so the card stays hidden.
  await page.route(/\/api\/v1\/(coins|referrals)/, (route) =>
    route.fulfill({ status: 404, json: { code: "NOT_FOUND" } }),
  );
}

test("settings entry, one-time code renewal, expiry and leaving the screen", async ({
  page,
}) => {
  await session(page);
  await page.route("**/api/v1/me/web-links", (route) =>
    route.fulfill({ json: [] }),
  );
  let issued = 0;
  await page.route("**/api/v1/me/web-link-codes", (route) => {
    expect(route.request().method()).toBe("POST");
    issued++;
    if (issued === 2) return route.abort();
    return route.fulfill({
      status: 201,
      json: {
        code: issued === 1 ? "K7M2Q9XB" : "A2B3C4D5",
        expiresAt: new Date(
          Date.now() + (issued === 1 ? 600000 : 2000),
        ).toISOString(),
      },
    });
  });
  await page.goto("/my");
  await page
    .getByRole("button", { name: "웹사이트 연동", exact: true })
    .click();
  await expect(page).toHaveURL(/\/web-links$/);
  await expect(
    page.getByText("연동된 웹사이트가 없어요", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "웹 연동 코드 받기", exact: true })
    .click();
  await expect(page.getByText("K7M2-Q9XB", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "새 코드 받기", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByText("새 코드를 받을까요?", { exact: true }),
  ).toHaveCount(0);
  expect(issued).toBe(1);
  await expect(page.getByText("K7M2-Q9XB", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "새 코드 받기", exact: true }).click();
  await page
    .getByRole("button", { name: "새 코드 받기", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("K7M2-Q9XB", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "웹 연동 코드 받기", exact: true })
    .click();
  await expect(page.getByText("A2B3-C4D5", { exact: true })).toBeVisible();
  await expect(
    page.getByText("코드가 만료됐어요. 새 코드를 받아 주세요", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("A2B3-C4D5", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "새 코드 받기", exact: true }).click();
  await expect(page.getByText("A2B3-C4D5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await page
    .getByRole("button", { name: "웹사이트 연동", exact: true })
    .click();
  await expect(page.getByText("A2B3-C4D5", { exact: true })).toHaveCount(0);
});

test("list failure retry, refresh after linking, unlink cancellation and retry", async ({
  page,
}) => {
  await session(page);
  let reads = 0;
  let deletes = 0;
  let linked = false;
  await page.route("**/api/v1/me/web-links", (route) => {
    reads++;
    if (reads === 1) return route.abort();
    return route.fulfill({
      json: linked
        ? [{ id: 7, createdAt: "2026-10-20T16:30:00.123456+09:00" }]
        : [],
    });
  });
  await page.route("**/api/v1/me/web-links/7", (route) => {
    expect(route.request().method()).toBe("DELETE");
    deletes++;
    if (deletes === 1) return route.abort();
    linked = false;
    return route.fulfill({ status: 204 });
  });
  await page.goto("/web-links");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("연동된 웹사이트가 없어요", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByText("연동된 웹사이트가 없어요", { exact: true }),
  ).toBeVisible();
  linked = true;
  await page
    .getByRole("button", { name: "연동 목록 새로고침", exact: true })
    .click();
  await expect(
    page.getByText("웹사이트 연동 #7", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/연동일:.*2026년 10월 20일.*16:30/),
  ).toBeVisible();
  await page.getByRole("button", { name: "연동 #7 해제", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(deletes).toBe(0);
  await page.getByRole("button", { name: "연동 #7 해제", exact: true }).click();
  await page.getByRole("button", { name: "연동 해제", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("웹사이트 연동 #7", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "연동 #7 해제", exact: true }).click();
  await page.getByRole("button", { name: "연동 해제", exact: true }).click();
  await expect(
    page.getByText("연동된 웹사이트가 없어요", { exact: true }),
  ).toBeVisible();
  expect(deletes).toBe(2);
});
