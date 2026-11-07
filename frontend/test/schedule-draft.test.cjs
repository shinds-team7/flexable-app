// Runs the real src/service/scheduleDraft.ts (transpiled).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/scheduleDraft.ts"),
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
const { draftButtons, parseAmount, withRo, confirmSpeech } = load();
const plain = (o) => JSON.parse(JSON.stringify(o));

const initial = { date: "2026-11-07", amount: 56200, categoryId: 3 };

test("only apply is on until something changes", () => {
  assert.deepEqual(plain(draftButtons(initial, { ...initial })), {
    apply: true,
    edit: false,
  });
});

test("any edit turns apply off and edit on", () => {
  for (const change of [
    { date: "2026-11-08" },
    { amount: 50000 },
    { categoryId: 4 },
  ]) {
    assert.deepEqual(plain(draftButtons(initial, { ...initial, ...change })), {
      apply: false,
      edit: true,
    });
  }
});

test("an empty amount can be registered only after typing one", () => {
  const unknown = { ...initial, amount: null };
  assert.deepEqual(plain(draftButtons(unknown, unknown)), {
    apply: false,
    edit: false,
  });
  assert.deepEqual(plain(draftButtons(unknown, { ...unknown, amount: 30000 })), {
    apply: false,
    edit: true,
  });
  // clearing the amount disables both
  assert.deepEqual(plain(draftButtons(initial, { ...initial, amount: null })), {
    apply: false,
    edit: false,
  });
});

test("amount keeps digits only", () => {
  assert.equal(parseAmount("56,200원"), 56200);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("0"), null);
});

test("the spoken question uses 로/으로 and only the confirm sentence", () => {
  assert.equal(withRo("데이트"), "데이트로");
  assert.equal(withRo("술약속"), "술약속으로");
  assert.equal(withRo("저녁 모임"), "저녁 모임으로");
  assert.equal(withRo("커피 한 잔"), "커피 한 잔으로");
  assert.equal(withRo("영화관"), "영화관으로");
  assert.equal(withRo("영화 보기"), "영화 보기로");
  assert.equal(
    confirmSpeech({ title: "데이트", date: "2026-11-07", amount: 56200 }),
    "11월 7일에 데이트로 56,200원을 등록할까요?",
  );
  assert.equal(
    confirmSpeech({ title: "술약속", date: "2026-12-24", amount: null }),
    "12월 24일 술약속에 쓸 금액을 알려 주세요.",
  );
});
