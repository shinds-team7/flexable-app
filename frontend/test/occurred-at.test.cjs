// Runs the real src/service/occurredAt.ts (transpiled).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/occurredAt.ts"),
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
const { occurredAtFor, seoulDateOf, validDate } = load();
// 2026-10-26 16:30 Seoul
const now = new Date("2026-10-26T07:30:00Z");

test("today keeps the current instant so it stays after balanceAt", () => {
  assert.equal(occurredAtFor("2026-10-26", undefined, now), now.toISOString());
});

test("other days use noon Seoul time", () => {
  assert.equal(
    occurredAtFor("2026-10-24", undefined, now),
    "2026-10-24T12:00:00+09:00",
  );
});

test("editing without changing the day keeps the stored value", () => {
  const stored = "2026-10-24T09:41:12.123456+09:00";
  assert.equal(occurredAtFor("2026-10-24", stored, now), stored);
  assert.equal(
    occurredAtFor("2026-10-25", stored, now),
    "2026-10-25T12:00:00+09:00",
  );
});

test("reads the Seoul day across midnight UTC", () => {
  assert.equal(seoulDateOf("2026-10-24T00:30:00+09:00"), "2026-10-24");
  assert.equal(seoulDateOf("2026-10-23T15:30:00Z"), "2026-10-24");
  assert.equal(seoulDateOf("not a date"), null);
});

test("validates calendar dates", () => {
  assert.equal(validDate("2026-10-26"), true);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-10-26T12:00"), false);
});
