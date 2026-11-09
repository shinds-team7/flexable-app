import { expect, test } from "@playwright/test";
import { session } from "./ui-ux-fixtures";

test.use({ reducedMotion: "reduce" });

for (const via of ["text", "voice"]) {
  for (const mode of ["create", "update", "settings-amount", "settings-payday"]) {
    test(`AI 수입 ${via}: ${mode} 확인 후 저장`, async ({ page }) => {
      if (via === "voice") await page.addInitScript(() => {
        class Recognition extends EventTarget {
          start() { setTimeout(() => {
            this.dispatchEvent(new Event("start"));
            const result = Object.assign([{ transcript: "오늘 용돈 5만원 받았어", confidence: 1 }], { isFinal: true });
            this.dispatchEvent(Object.assign(new Event("result"), { resultIndex: 0, results: [result] }));
            this.dispatchEvent(new Event("end"));
          }, 100); }
          stop() { this.dispatchEvent(new Event("end")); }
          abort() { this.stop(); }
        }
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition = Recognition;
      });
      await session(page);
      const tx = { operation: mode === "update" ? "UPDATE" : "CREATE", transactionId: mode === "update" ? 42 : null,
        title: "용돈", date: "2026-10-29", categoryId: 7, category: "기타 수입", amount: 50000, changes: ["AMOUNT"] };
      const settings = { incomeAmount: mode === "settings-amount" ? 3000000 : 2000000,
        payday: mode === "settings-payday" ? 15 : 25, expectedIncomeAmount: 2000000, expectedPayday: 25 };
      const isSettings = mode.startsWith("settings");
      const action = isSettings ? { type: "INCOME_SETTINGS", incomeSettings: settings } : { type: "INCOME_TRANSACTION", incomeTransaction: tx };
      const saves: { body: unknown; method: string; key?: string }[] = [];
      await page.route("**/api/v1/chat/messages", async (route) => {
        expect(route.request().postDataJSON().accepts).toEqual(["SCHEDULE", "INCOME"]);
        await route.fulfill({ json: { reply: "확인해 주세요", action } });
      });
      await page.route(isSettings ? "**/api/v1/budget/settings/income" : mode === "update" ? "**/api/v1/transactions/42" : "**/api/v1/transactions", async (route) => {
        if (route.request().method() === "GET") {
          if (mode === "update") return route.fulfill({ json: { type: "INCOME", occurredAt: "2026-10-28T11:00:00+09:00" } });
          return route.fallback();
        }
        saves.push({ body: route.request().postDataJSON(), method: route.request().method(), key: route.request().headers()["idempotency-key"] });
        await route.fulfill({ status: mode === "create" ? 201 : 200, json: {} });
      });
      if (via === "voice") {
        await page.goto("/home");
        await page.getByRole("button", { name: "거래 추가", exact: true }).click();
        await page.getByRole("button", { name: "음성 입력", exact: true }).click();
      } else {
        await page.goto("/chatbot");
        await page.getByRole("button", { name: "선택하고 시작하기" }).click();
        await page.getByLabel("AI 메이트에게 질문", { exact: true }).fill("오늘 용돈 5만원 받았어");
        await page.getByRole("button", { name: "보내기", exact: true }).click();
        await expect(page.getByLabel("AI 메이트 캐릭터", { exact: true })).toHaveCount(0);
      }
      await expect(page.getByRole("button", { name: "반영", exact: true })).toBeVisible();
      expect(saves).toHaveLength(0);
      await page.getByRole("button", { name: "반영", exact: true }).click();
      await expect.poll(() => saves.length).toBe(1);
      if (isSettings) expect(saves[0]).toMatchObject({ method: "PATCH", body: settings });
      else if (mode === "update") expect(saves[0]).toMatchObject({ method: "PATCH", body: { amount: 50000 } });
      else {
        expect(saves[0]).toMatchObject({ method: "POST", body: { type: "INCOME", amount: 50000, title: "용돈", categoryId: 7 } });
        expect(saves[0].key).toBeTruthy();
      }
    });
  }
}

test("수입 제안 취소는 저장하지 않으며 실패 재시도는 같은 멱등 키를 사용", async ({ page }) => {
  await session(page);
  await page.route("**/api/v1/chat/messages", (route) => route.fulfill({ json: { reply: "확인해 주세요", action: {
    type: "INCOME_TRANSACTION", incomeTransaction: { operation: "CREATE", transactionId: null, title: "용돈", date: "2026-10-29", categoryId: 7, category: "기타 수입", amount: 50000, changes: [] },
  } } }));
  const keys: string[] = [];
  await page.route("**/api/v1/transactions", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    keys.push(route.request().headers()["idempotency-key"]);
    return route.fulfill(keys.length === 1 ? { status: 500, json: { code: "INTERNAL_ERROR", message: "잠시 후 재시도해 주세요" } } : { status: 201, json: {} });
  });
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  await input.fill("용돈 5만원 기록");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("취소했어요")).toBeVisible();
  expect(keys).toHaveLength(0);
  await input.fill("용돈 5만원 기록");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(page.getByText("잠시 후 재시도해 주세요")).toBeVisible();
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(page.getByText("반영했어요")).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toEqual(keys[1]);
});
