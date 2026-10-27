// Runs the real src/service/receiptImport/review.ts and guessCategory.ts (transpiled).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file) {
  const source = fs.readFileSync(
    require.resolve(`../src/service/receiptImport/${file}`),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const context = { exports: {}, Date };
  vm.runInNewContext(js, context);
  return context.exports;
}
const { dupKey, dateRange } = load("review.ts");
const { guessCategoryName } = load("guessCategory.ts");

test("duplicate key ignores spacing and case but not amount or type", () => {
  const a = dupKey("2026-10-26", "EXPENSE", 6800, "CU 광화문점");
  assert.equal(a, dupKey("2026-10-26", "EXPENSE", 6800, "cu광화문점"));
  assert.notEqual(a, dupKey("2026-10-26", "INCOME", 6800, "CU 광화문점"));
  assert.notEqual(a, dupKey("2026-10-26", "EXPENSE", 6900, "CU 광화문점"));
});

test("date range covers every candidate and refuses more than a year", () => {
  assert.equal(
    JSON.stringify(dateRange(["2026-10-26", "2026-10-23", "2026-10-24"])),
    JSON.stringify({ from: "2026-10-23", to: "2026-10-26" }),
  );
  assert.equal(dateRange(["2025-01-01", "2026-10-26"]), null);
  assert.equal(dateRange([]), null);
});

test("category guess falls back to the default 기타 categories", () => {
  assert.equal(guessCategoryName("스타벅스", "EXPENSE"), "카페·간식");
  assert.equal(guessCategoryName("CU 광화문점", "EXPENSE"), "생활·마트");
  assert.equal(guessCategoryName("처음 보는 가게", "EXPENSE"), "기타");
  assert.equal(guessCategoryName("급여", "INCOME"), "급여");
  assert.equal(guessCategoryName("홍길동", "INCOME"), "기타 수입");
});
