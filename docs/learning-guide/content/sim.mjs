// 학습용 계산 시뮬레이터. BudgetCalculator.java를 그대로 옮긴 것이며 서비스 코드가 아니다.
// 빌드 때 BudgetCalculatorTest의 기대값으로 맞는지 검사한다(simTests). 공휴일은 PublicHolidays.java에서 읽는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.env.REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const holidaySrc = fs.readFileSync(path.join(REPO, "backend/src/main/java/com/flexable/api/budget/PublicHolidays.java"), "utf8");
const HOLIDAYS = [...holidaySrc.matchAll(/LocalDate\.of\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/g)].map(
  (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
);

export const SIM_SOURCE = `
var BudgetSim = (function () {
  "use strict";
  var HOLIDAYS = ${JSON.stringify(HOLIDAYS)};
  var DAY = 86400000, KST = 9 * 3600000;
  function days(s) { var p = s.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY; }
  function str(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
  function dow(n) { return new Date(n * DAY).getUTCDay(); } // 0=일
  function ym(n) { var d = new Date(n * DAY); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  function ymLen(m) { return new Date(Date.UTC(Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate(); }
  function ymAt(m, day) { return Date.UTC(Math.floor(m / 12), m % 12, day) / DAY; }
  /** 그 달의 수입일(31 등 없는 날은 말일로) — paydayIn */
  function paydayIn(m, payday) { return ymAt(m, Math.min(payday, ymLen(m))); }
  /** 토·일·공휴일이면 다음 평일 — incomeDayIn */
  function incomeDayIn(m, payday) {
    var d = paydayIn(m, payday);
    while (dow(d) === 6 || dow(d) === 0 || HOLIDAYS.indexOf(str(d)) >= 0) d++;
    return d;
  }
  /** 오늘 이후(오늘 제외) 가장 가까운 수입일 — nextPayday */
  function nextPayday(today, payday) {
    var m = ym(today);
    for (var i = -1; i <= 1; i++) { var d = incomeDayIn(m + i, payday); if (d > today) return d; }
    return incomeDayIn(m + 2, payday);
  }
  /** 오늘 또는 그 이전의 가장 가까운 수입일 — previousPayday */
  function previousPayday(today, payday) {
    var m = ym(today);
    for (var i = 0; i >= -2; i--) { var d = incomeDayIn(m + i, payday); if (d <= today) return d; }
    return incomeDayIn(m - 3, payday);
  }
  /** [from, toExclusive) 사이에 고정지출 날짜가 몇 번 오는지 — occurrences */
  function occurrences(day, from, toEx) {
    var c = 0;
    for (var m = ym(from); m <= ym(toEx); m++) { var d = paydayIn(m, day); if (d >= from && d < toEx) c++; }
    return c;
  }
  function kstDate(ms) { return Math.floor((ms + KST) / DAY); }
  /** BudgetCalculator.compute. 금액은 원 단위 정수, 나눗셈은 내림. */
  function compute(input, todayStr) {
    var today = days(todayStr);
    var next = nextPayday(today, input.payday);
    var cycleStart = previousPayday(today, input.payday);
    var daysLeft = Math.max(1, next - today);
    var weekStart = today - ((dow(today) + 6) % 7);
    var weekEnd = weekStart + 6;
    var estimated = input.balance - (input.savedSinceBalance || 0);
    var todaySpent = 0, weekSpent = 0;
    input.transactions.forEach(function (t) {
      if (t.at > input.balanceAt) estimated += t.type === "INCOME" ? t.amount : -t.amount;
      if (t.type === "EXPENSE" && !t.fixed) {
        var d = kstDate(t.at);
        if (d === today) todaySpent += t.amount;
        if (d >= weekStart && d <= weekEnd) weekSpent += t.amount;
      }
    });
    var reservedFixed = 0;
    input.fixed.forEach(function (f) { reservedFixed += f.amount * occurrences(f.day, today + 1, next); });
    var remaining = estimated - reservedFixed - input.cardUnpaid - input.protectedTotal;
    var dailyBudget = Math.floor(Math.max(0, remaining + todaySpent) / daysLeft);
    var todayAvailable = dailyBudget - todaySpent;
    var shortage = remaining < 0 ? -remaining : Math.max(0, todaySpent - dailyBudget);
    var weekLast = weekEnd < next ? weekEnd : next - 1;
    var weekDaysLeft = Math.max(1, weekLast - today + 1);
    var weekAvailable = Math.max(0, dailyBudget * weekDaysLeft - todaySpent);
    return { date: str(today), nextPayday: str(next), daysLeft: daysLeft, estimatedBalance: estimated,
      reservedFixed: reservedFixed, cardUnpaid: input.cardUnpaid, protectedTotal: input.protectedTotal,
      remaining: remaining, todaySpent: todaySpent, dailyBudget: dailyBudget, todayAvailable: todayAvailable,
      shortage: shortage, weekSpent: weekSpent, weekDaysLeft: weekDaysLeft, weekAvailable: weekAvailable,
      cycleStart: str(cycleStart) };
  }
  /** "2026-10-13T12:30"(한국 시각) → epoch ms */
  function kst(local) { var p = local.split("T"); var hm = (p[1] || "00:00").split(":"); return days(p[0]) * DAY + (+hm[0]) * 3600000 + (+hm[1]) * 60000 - KST; }
  return { compute: compute, kst: kst, days: days, str: str,
    nextPayday: function (t, p) { return str(nextPayday(days(t), p)); },
    previousPayday: function (t, p) { return str(previousPayday(days(t), p)); },
    occurrences: function (day, f, t) { return occurrences(day, days(f), days(t)); },
    holidays: HOLIDAYS };
})();
`;

const Sim = new Function(SIM_SOURCE + "; return BudgetSim;")();

/** 가이드 전체가 쓰는 가상 사용자 시나리오(실제 사용자 데이터 아님). */
export const SCENARIO = {
  today: "2026-10-13",
  balance: 1250000,
  balanceAtLocal: "2026-10-13T10:00",
  payday: 25,
  incomeAmount: 2400000,
  cardUnpaid: 0,
  fixed: [{ name: "월세", amount: 450000, day: 15 }],
  protected: [{ name: "적금", amount: 300000 }],
  seedBase: 500000,
  lunchLocal: "2026-10-13T12:30",
  createAmount: 9000,
  editAmount: 10000,
};
function inputWith(txs) {
  return {
    balance: SCENARIO.balance,
    balanceAt: Sim.kst(SCENARIO.balanceAtLocal),
    payday: SCENARIO.payday,
    cardUnpaid: SCENARIO.cardUnpaid,
    fixed: SCENARIO.fixed,
    protectedTotal: SCENARIO.protected.reduce((a, p) => a + p.amount, 0),
    transactions: txs,
    savedSinceBalance: 0,
  };
}
export function scenarioNumbers() {
  const lunch = (amount) => [{ type: "EXPENSE", amount, at: Sim.kst(SCENARIO.lunchLocal), fixed: false }];
  return {
    s: SCENARIO,
    before: Sim.compute(inputWith([]), SCENARIO.today),
    created: Sim.compute(inputWith(lunch(SCENARIO.createAmount)), SCENARIO.today),
    edited: Sim.compute(inputWith(lunch(SCENARIO.editAmount)), SCENARIO.today),
  };
}

/** BudgetCalculatorTest.java의 기대값을 그대로 옮긴 검사. 하나라도 다르면 빌드가 멈춘다. */
export function simTests() {
  const out = [];
  const eq = (name, got, want) => out.push({ name, ok: got === want, detail: `기대 ${want}, 계산 ${got}` });
  const N = Sim.nextPayday, P = Sim.previousPayday, O = Sim.occurrences;
  // nextPaydayIsStrictlyAfterToday
  eq("nextPaydayIsStrictlyAfterToday#1", N("2026-10-13", 23), "2026-10-23");
  eq("nextPaydayIsStrictlyAfterToday#2", N("2026-10-23", 23), "2026-11-23");
  eq("nextPaydayIsStrictlyAfterToday#3", P("2026-10-23", 23), "2026-10-23");
  eq("nextPaydayIsStrictlyAfterToday#4", P("2026-10-13", 23), "2026-09-23");
  // day31MeansMonthEnd
  eq("day31MeansMonthEnd#1", N("2026-03-10", 31), "2026-03-31");
  eq("day31MeansMonthEnd#2", N("2026-04-10", 31), "2026-04-30");
  eq("day31MeansMonthEnd#3", N("2028-02-28", 31), "2028-02-29");
  // weekendPaydayMovesToMonday
  eq("weekendPaydayMovesToMonday#1", N("2026-10-13", 25), "2026-10-26");
  eq("weekendPaydayMovesToMonday#2", N("2026-10-25", 25), "2026-10-26");
  eq("weekendPaydayMovesToMonday#3", P("2026-10-25", 25), "2026-09-25");
  eq("weekendPaydayMovesToMonday#4", P("2026-10-26", 25), "2026-10-26");
  eq("weekendPaydayMovesToMonday#5", N("2026-02-10", 31), "2026-03-02");
  eq("weekendPaydayMovesToMonday#6", N("2026-11-01", 31), "2026-11-02");
  eq("weekendPaydayMovesToMonday#7", P("2026-11-01", 31), "2026-09-30");
  eq("weekendPaydayMovesToMonday#8", P("2026-11-03", 31), "2026-11-02");
  // holidayPaydayMovesToNextWeekday
  eq("holidayPaydayMovesToNextWeekday#1", N("2026-12-10", 25), "2026-12-28");
  eq("holidayPaydayMovesToNextWeekday#2", P("2026-12-27", 25), "2026-11-25");
  eq("holidayPaydayMovesToNextWeekday#3", P("2026-12-28", 25), "2026-12-28");
  eq("holidayPaydayMovesToNextWeekday#4", N("2026-12-20", 1), "2027-01-04");
  eq("holidayPaydayMovesToNextWeekday#5", N("2027-02-01", 6), "2027-02-10");
  eq("holidayPaydayMovesToNextWeekday#6", N("2027-09-01", 15), "2027-09-17");
  eq("holidayPaydayMovesToNextWeekday#7", N("2027-10-01", 9), "2027-10-12");
  // holidaysBeforeNovember2026KeepPastPaydays
  eq("holidaysBeforeNovember2026KeepPastPaydays#1", P("2026-10-20", 9), "2026-10-09");
  eq("holidaysBeforeNovember2026KeepPastPaydays#2", P("2026-03-10", 31), "2026-03-02");
  // fixedExpenseCountedOnlyInsideWindow
  eq("fixedExpenseCountedOnlyInsideWindow#1", O(1, "2026-10-13", "2026-10-25"), 0);
  eq("fixedExpenseCountedOnlyInsideWindow#2", O(13, "2026-10-13", "2026-10-25"), 1);
  eq("fixedExpenseCountedOnlyInsideWindow#3", O(25, "2026-10-13", "2026-10-25"), 0);
  eq("fixedExpenseCountedOnlyInsideWindow#4", O(1, "2026-10-26", "2026-11-25"), 1);
  const k = Sim.kst;
  const base = (o) => ({ cardUnpaid: 0, savedSinceBalance: 0, ...o });
  // computesDocumentedExample
  {
    const r = Sim.compute(base({ balance: 1250000, balanceAt: k("2026-10-13T10:00"), payday: 25, fixed: [{ day: 15, amount: 450000 }], protectedTotal: 300000,
      transactions: [
        { type: "EXPENSE", amount: 12000, at: k("2026-10-13T12:30") },
        { type: "EXPENSE", amount: 58000, at: k("2026-10-13T09:00") },
        { type: "INCOME", amount: 30000, at: k("2026-10-13T13:00") },
      ] }), "2026-10-13");
    const t = "computesDocumentedExample";
    eq(t + ".daysLeft", r.daysLeft, 13);
    eq(t + ".estimatedBalance", r.estimatedBalance, 1250000 - 12000 + 30000);
    eq(t + ".reservedFixed", r.reservedFixed, 450000);
    eq(t + ".remaining", r.remaining, 1268000 - 450000 - 300000);
    eq(t + ".todaySpent", r.todaySpent, 70000);
    eq(t + ".dailyBudget", r.dailyBudget, Math.floor((518000 + 70000) / 13));
    eq(t + ".todayAvailable", r.todayAvailable, Math.floor(588000 / 13) - 70000);
    eq(t + ".shortage", r.shortage, 70000 - Math.floor(588000 / 13));
    eq(t + ".cycleStart", r.cycleStart, "2026-09-25");
    eq(t + ".weekDaysLeft", r.weekDaysLeft, 6);
    eq(t + ".weekAvailable", r.weekAvailable, Math.max(0, r.dailyBudget * 6 - 70000));
  }
  // postedFixedExpenseLeavesBalanceButNotDailySpending
  {
    const r = Sim.compute(base({ balance: 1250000, balanceAt: k("2026-10-13T10:00"), payday: 25, fixed: [{ day: 15, amount: 450000 }], protectedTotal: 0,
      transactions: [
        { type: "EXPENSE", amount: 450000, at: k("2026-10-15T00:00"), fixed: true },
        { type: "EXPENSE", amount: 10000, at: k("2026-10-15T12:00") },
      ] }), "2026-10-15");
    const t = "postedFixedExpenseLeavesBalanceButNotDailySpending";
    eq(t + ".estimatedBalance", r.estimatedBalance, 1250000 - 450000 - 10000);
    eq(t + ".reservedFixed", r.reservedFixed, 0);
    eq(t + ".remaining", r.remaining, 790000);
    eq(t + ".todaySpent", r.todaySpent, 10000);
    eq(t + ".weekSpent", r.weekSpent, 10000);
    eq(t + ".dailyBudget", r.dailyBudget, Math.floor(800000 / 11));
  }
  // fixedExpenseNoLongerComesBackAfterItsDay
  {
    const before = Sim.compute(base({ balance: 1000000, balanceAt: k("2026-10-13T10:00"), payday: 25, fixed: [{ day: 15, amount: 450000 }], protectedTotal: 0, transactions: [] }), "2026-10-14");
    const after = Sim.compute(base({ balance: 1000000, balanceAt: k("2026-10-13T10:00"), payday: 25, fixed: [{ day: 15, amount: 450000 }], protectedTotal: 0,
      transactions: [{ type: "EXPENSE", amount: 450000, at: k("2026-10-15T00:00"), fixed: true }] }), "2026-10-16");
    eq("fixedExpenseNoLongerComesBackAfterItsDay.before", before.remaining, 550000);
    eq("fixedExpenseNoLongerComesBackAfterItsDay.after", after.remaining, 550000);
  }
  // weekStopsBeforePayday
  {
    const r = Sim.compute(base({ balance: 300000, balanceAt: k("2026-10-21T09:00"), payday: 23, fixed: [], protectedTotal: 0, transactions: [] }), "2026-10-21");
    const t = "weekStopsBeforePayday";
    eq(t + ".daysLeft", r.daysLeft, 2);
    eq(t + ".weekDaysLeft", r.weekDaysLeft, 2);
    eq(t + ".dailyBudget", r.dailyBudget, 150000);
    eq(t + ".weekAvailable", r.weekAvailable, 300000);
  }
  // negativeRemainingReportsShortage
  {
    const r = Sim.compute(base({ balance: 100000, balanceAt: k("2026-10-13T10:00"), payday: 25, cardUnpaid: 50000, fixed: [{ day: 20, amount: 200000 }], protectedTotal: 0, transactions: [] }), "2026-10-13");
    const t = "negativeRemainingReportsShortage";
    eq(t + ".remaining", r.remaining, -150000);
    eq(t + ".dailyBudget", r.dailyBudget, 0);
    eq(t + ".todayAvailable", r.todayAvailable, 0);
    eq(t + ".shortage", r.shortage, 150000);
  }
  return out;
}
