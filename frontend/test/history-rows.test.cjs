// Runs the real src/service/historyRows.ts (transpiled).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/historyRows.ts"),
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
const { dayAmounts, historyGroups } = load();
const plain = (o) => JSON.parse(JSON.stringify(o));
const dateOf = (t) => t.date;

const txs = [
  { id: 2, type: "EXPENSE", amount: 8000, date: "2026-11-12" },
  { id: 1, type: "INCOME", amount: 30000, date: "2026-11-10" },
];
const plans = [
  { id: 7, amount: 25000, date: "2026-11-14" },
  { id: 8, amount: 5000, date: "2026-11-12" },
];

test("planned amounts are counted apart from actual spending", () => {
  const daily = dayAmounts(txs, plans, dateOf);
  assert.deepEqual(plain(daily.get("2026-11-12")), {
    expense: 8000,
    income: 0,
    planned: 5000,
  });
  assert.deepEqual(plain(daily.get("2026-11-14")), {
    expense: 0,
    income: 0,
    planned: 25000,
  });
  assert.deepEqual(plain(daily.get("2026-11-10")), {
    expense: 0,
    income: 30000,
    planned: 0,
  });
});

test("planned rows join all and expense lists, newest date first, after actual rows", () => {
  const rows = (filter) =>
    historyGroups(txs, plans, filter, dateOf).map(([date, list]) => [
      date,
      list.map((r) => `${r.kind}:${r.item.id}`),
    ]);
  assert.deepEqual(plain(rows("ALL")), [
    ["2026-11-14", ["planned:7"]],
    ["2026-11-12", ["tx:2", "planned:8"]],
    ["2026-11-10", ["tx:1"]],
  ]);
  assert.deepEqual(plain(rows("EXPENSE")), [
    ["2026-11-14", ["planned:7"]],
    ["2026-11-12", ["tx:2", "planned:8"]],
  ]);
  assert.deepEqual(plain(rows("INCOME")), [["2026-11-10", ["tx:1"]]]);
});
