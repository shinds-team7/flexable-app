import type { Page } from "@playwright/test";

const date = "2026-10-29";
const wallet = {
  balance: 200,
  passive: { collectable: 3, collectedToday: 0, dailyLimit: 30, nextAt: null },
  equippedOutfitId: null,
};
export const category = {
  id: 1,
  name: "식비",
  type: "EXPENSE",
  icon: "restaurant",
  color: "#0046FF",
  isDefault: true,
};
const transaction = {
  id: 1,
  type: "EXPENSE",
  amount: 12000,
  categoryId: 1,
  category,
  title: "점심",
  memo: null,
  occurredAt: "2026-10-28T12:00:00+09:00",
  createdAt: "2026-10-28T12:00:00+09:00",
  fromFixed: false,
};

export async function session(page: Page, today = date) {
  await page.clock.setFixedTime(new Date(`${today}T12:00:00+09:00`));
  await page.addInitScript(() => {
    localStorage.setItem("flexable.service.token", "ui-ux-test");
    localStorage.setItem("flexable.service.homeStyle", "classic");
  });
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (data: unknown) => route.fulfill({ json: data });
    if (path === "/me")
      return json({
        id: 1,
        email: "ui@example.com",
        provider: "email",
        onboarded: true,
        createdAt: `${date}T00:00:00+09:00`,
      });
    if (path === "/budget/today")
      return json({
        date: today,
        nextPayday: "2026-11-25",
        cycleStart: "2026-10-26",
        daysLeft: 27,
        estimatedBalance: 500000,
        reservedFixed: 0,
        cardUnpaid: 0,
        protectedTotal: 0,
        remaining: 500000,
        dailyBudget: 10000,
        todaySpent: 12000,
        todayAvailable: -2000,
        shortage: 2000,
        weekSpent: 12000,
        weekDaysLeft: 4,
        weekAvailable: 28000,
        hasTransactions: true,
        characterPoints: 30,
        characterDelta: 15,
        dayPreset: "EVEN",
        dayBudgets: [10000, 10000, 10000, 10000, 10000, 10000, 10000],
      });
    if (path === "/budget/seed-money")
      return json({
        base: 50000,
        saved: 30000,
        total: 80000,
        monthlyGoal: 30000,
        pending: null,
        entries: [
          {
            cycleEnd: "2026-09-24",
            choice: "GOAL",
            amount: 30000,
            createdAt: "2026-09-25T12:00:00+09:00",
          },
        ],
      });
    if (path === "/coins") return json(wallet);
    if (path === "/coins/check-in") return json({ wallet, rewards: [] });
    if (path === "/coins/ledger")
      return json({
        items: [
          {
            id: 1,
            reason: "PASSIVE",
            amount: 3,
            refDate: null,
            outfitId: null,
            createdAt: `${date}T10:00:00+09:00`,
          },
        ],
        nextBefore: null,
      });
    if (path === "/coins/collect")
      return json({
        wallet: {
          ...wallet,
          balance: 203,
          passive: { ...wallet.passive, collectable: 0, collectedToday: 3 },
        },
        amount: 3,
      });
    if (path === "/outfits")
      return json({
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
        ],
      });
    if (path === "/categories") return json([category]);
    if (path === "/scheduled-expenses") return json({ items: [] });
    if (path === "/transactions/1") return json(transaction);
    if (path === "/transactions") {
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      return json({
        items:
          "2026-10-28" >= from && "2026-10-28" <= to
            ? [
                transaction,
                {
                  ...transaction,
                  id: 2,
                  title: "월세",
                  fromFixed: true,
                  amount: 300000,
                },
              ]
            : [],
      });
    }
    if (path === "/analysis/summary")
      return json({
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        expenseTotal: 20000,
        incomeTotal: 0,
        expenseCount: 2,
        byCategory: [
          {
            categoryId: 1,
            name: "식비",
            icon: "restaurant",
            color: "#0046FF",
            amount: 12000,
            count: 1,
            ratio: 0.6,
          },
          {
            categoryId: 2,
            name: "교통",
            icon: "bus",
            color: "#0B8A5B",
            amount: 8000,
            count: 1,
            ratio: 0.4,
          },
        ],
        byDay: [],
      });
    return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });
}
