// Runs the real src/utils/dayWeights.ts (transpiled): drag position → weight, record hints.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/utils/dayWeights.ts"),
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
const { weightAt, percents, recordHint, sameWeights } = load();

test("top of the bar is the max weight, bottom is the min, outside is clamped", () => {
  assert.equal(weightAt(0, 200, 5, 30), 30);
  assert.equal(weightAt(200, 200, 5, 30), 5);
  assert.equal(weightAt(100, 200, 5, 30), 18);
  assert.equal(weightAt(-40, 200, 5, 30), 30);
  assert.equal(weightAt(260, 200, 5, 30), 5);
  assert.equal(weightAt(50, 0, 5, 30), 5);
});

test("percent labels are shares of the total", () => {
  assert.deepEqual(
    percents([14, 14, 14, 14, 14, 14, 14]),
    [14, 14, 14, 14, 14, 14, 14],
  );
  assert.deepEqual(
    percents([10, 10, 9, 9, 19, 29, 14]),
    [10, 10, 9, 9, 19, 29, 14],
  );
  assert.deepEqual(
    percents([10, 30, 10, 10, 10, 10, 10]),
    [11, 33, 11, 11, 11, 11, 11],
  );
});

test("record hint says what is missing or which period was used", () => {
  const base = { to: "2026-10-26", minDays: 7, minWeekdays: 3 };
  assert.equal(
    recordHint({ ...base, from: null, days: 0, weekdays: 0 }, false),
    "지출을 기록한 날이 7일 더 있으면 쓸 수 있어요",
  );
  assert.equal(
    recordHint({ ...base, from: "2026-10-03", days: 8, weekdays: 2 }, false),
    "3개 요일 이상 기록이 있으면 쓸 수 있어요",
  );
  assert.equal(
    recordHint({ ...base, from: "2026-09-29", days: 28, weekdays: 7 }, true),
    "9월 29일~10월 26일 기록 28일 기준",
  );
});

test("weights compare element by element", () => {
  assert.equal(sameWeights([1, 2], [1, 2]), true);
  assert.equal(sameWeights([1, 2], [2, 1]), false);
  assert.equal(sameWeights(null, [1]), false);
});
