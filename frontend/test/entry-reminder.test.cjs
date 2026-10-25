// Runs the real src/service/entryReminderTimes.ts (transpiled). Dates are built in local time like the app.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/entryReminderTimes.ts"),
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
const { entryReminderTimes } = load();
const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);
const times = (last, now, count) =>
  Array.from(entryReminderTimes(last, now, count), (x) => x.getTime());

test("repeats every 24 hours from the last entry", () => {
  assert.deepEqual(times(at(25, 12, 30), at(25, 13), 3), [
    at(26, 12, 30).getTime(),
    at(27, 12, 30).getTime(),
    at(28, 12, 30).getTime(),
  ]);
});

test("moves late-night times to 9 the next morning", () => {
  assert.deepEqual(times(at(25, 23), at(25, 23, 5), 2), [
    at(27, 9).getTime(),
    at(28, 9).getTime(),
  ]);
});

test("moves early-morning times to 9 the same morning", () => {
  assert.deepEqual(times(at(25, 3), at(25, 3, 5), 1), [at(26, 9).getTime()]);
});

test("22:00 is night and 9:00 is not", () => {
  assert.deepEqual(times(at(25, 22), at(25, 22), 1), [at(27, 9).getTime()]);
  assert.deepEqual(times(at(25, 9), at(25, 9), 1), [at(26, 9).getTime()]);
});

test("skips times that already passed", () => {
  assert.deepEqual(times(at(20, 12), at(25, 15), 2), [
    at(26, 12).getTime(),
    at(27, 12).getTime(),
  ]);
});

test("keeps a night reminder that was moved past now", () => {
  // 24일 23시 차례는 25일 9시로 미뤄졌고, 지금(25일 8시)은 아직 그 전이다.
  assert.deepEqual(times(at(23, 23), at(25, 8), 2), [
    at(25, 9).getTime(),
    at(26, 9).getTime(),
  ]);
});
