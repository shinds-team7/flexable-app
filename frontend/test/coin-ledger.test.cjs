// Runs the real src/service/coinLedger.ts (transpiled): the coin history puts the amount first.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/coinLedger.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(js, context);
  return context.exports;
}
const { ledgerTitle, ledgerDetail } = load();

test("puts the signed amount before the reason", () => {
  assert.equal(
    ledgerTitle({ reason: "SIGNUP_GIFT", amount: 200 }),
    "+200 가입 선물",
  );
  assert.equal(
    ledgerTitle({ reason: "PURCHASE", amount: -200 }),
    "-200 코스튬 구매",
  );
  assert.equal(ledgerTitle({ reason: "PASSIVE", amount: 3 }), "+3 코인 모으기");
  assert.equal(
    ledgerTitle({ reason: "REFUND", amount: 1200 }),
    "+1,200 코스튬 구매 코인 돌려받음",
  );
});

test("an unknown reason still shows the amount", () => {
  assert.equal(ledgerTitle({ reason: "NEW_REASON", amount: 10 }), "+10 코인");
});

test("budget bonus names the day it was kept", () => {
  assert.equal(
    ledgerDetail({ reason: "BUDGET_BONUS", amount: 5, refDate: "2026-10-20" }),
    "10월 20일 예산을 지켰어요",
  );
  assert.equal(
    ledgerDetail({ reason: "SIGNUP_GIFT", amount: 200, refDate: null }),
    "",
  );
});

test("attendance marks the streak bonus day", () => {
  assert.equal(ledgerTitle({ reason: "ATTENDANCE", amount: 5 }), "+5 출석체크");
  assert.equal(ledgerDetail({ reason: "ATTENDANCE", amount: 5 }), "");
  assert.equal(
    ledgerDetail({ reason: "ATTENDANCE", amount: 30 }),
    "연속 출석 보너스",
  );
});
