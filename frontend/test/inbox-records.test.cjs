// Runs the real src/service/inboxRecords.ts (transpiled): what the inbox keeps on the device.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/inboxRecords.ts"),
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
const { plan, noteBudget, isUnread, hasUnread, KEEP } = load();
const EMPTY = { sent: [], pending: [] };
const plain = (x) => JSON.parse(JSON.stringify(x));

test("a reminder counts as sent once its time has passed", () => {
  let r = plan(EMPTY, 100, "entry", [200, 300]);
  assert.deepEqual(plain(r), {
    sent: [],
    pending: [
      { kind: "entry", at: 200 },
      { kind: "entry", at: 300 },
    ],
  });
  r = plan(r, 250);
  assert.deepEqual(plain(r.sent), [{ kind: "entry", at: 200 }]);
  assert.deepEqual(plain(r.pending), [{ kind: "entry", at: 300 }]);
});

test("rescheduling drops the old future times of that kind only", () => {
  let r = plan(EMPTY, 0, "entry", [200, 300]);
  r = plan(r, 0, "seed", [500]);
  r = plan(r, 250, "entry", [400]);
  assert.deepEqual(plain(r.sent), [{ kind: "entry", at: 200 }]);
  assert.deepEqual(plain(r.pending), [
    { kind: "seed", at: 500 },
    { kind: "entry", at: 400 },
  ]);
});

test("cancelling keeps what was already sent and forgets the rest", () => {
  let r = plan(EMPTY, 0, "seed", [100]);
  r = plan(r, 150, "seed", []);
  assert.deepEqual(plain(r), {
    sent: [{ kind: "seed", at: 100 }],
    pending: [],
  });
});

test("past times passed when scheduling are not kept as pending", () => {
  assert.deepEqual(plain(plan(EMPTY, 100, "seed", [50])), EMPTY);
});

test("sent reminders are newest first, not repeated, and capped", () => {
  let r = EMPTY;
  for (let i = 1; i <= KEEP + 5; i++)
    r = plan(r, i * 10, "entry", [i * 10 + 5]);
  r = plan(r, 10000);
  assert.equal(r.sent.length, KEEP);
  assert.equal(r.sent[0].at, (KEEP + 5) * 10 + 5);
  assert.equal(new Set(r.sent.map((s) => s.at)).size, KEEP);
});

test("budget state is noted once per day and state, from the server value", () => {
  let n = noteBudget([], "2026-10-27", 1000, 1);
  assert.deepEqual(n, []);
  n = noteBudget(n, "2026-10-27", 0, 2);
  assert.deepEqual(plain(n), [{ date: "2026-10-27", over: false, at: 2 }]);
  assert.equal(noteBudget(n, "2026-10-27", 0, 3), n);
  n = noteBudget(n, "2026-10-27", -500, 4);
  assert.deepEqual(plain(n[0]), { date: "2026-10-27", over: true, at: 4 });
  assert.equal(noteBudget(n, "2026-10-27", -900, 5), n);
  n = noteBudget(n, "2026-10-28", -1, 6);
  assert.equal(n.length, 3);
});

test("only the opened key is read, including older and simultaneous notifications", () => {
  const older = { key: "fixed:1", at: 100 };
  const opened = { key: "coin:1", at: 200 };
  const simultaneous = { key: "coin:2", at: 200 };
  const read = [opened];
  assert.equal(isUnread(opened, 0, read), false);
  assert.equal(isUnread(older, 0, read), true);
  assert.equal(isUnread(simultaneous, 0, read), true);
  assert.equal(hasUnread([older, opened, simultaneous], 0, read), true);
  assert.equal(hasUnread([opened], 0, read), false);
  assert.equal(hasUnread([], 0, read), false);
});

test("legacy read timestamps are preserved without hiding later unread items", () => {
  assert.equal(isUnread({ key: "coin:1", at: 100 }, 200, []), false);
  assert.equal(isUnread({ key: "coin:2", at: 201 }, 200, []), true);
});
