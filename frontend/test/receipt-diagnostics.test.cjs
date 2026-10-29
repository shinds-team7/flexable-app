const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = {};
  cache[name] = exports;
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        require.resolve(`../src/service/receiptImport/${name}.ts`),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, require: (name) => load(name.slice(2)), Date },
  );
  return exports;
}
const { maskOcrText, createImportDiagnostic } = load("diagnostics");
const { receiptDiagnostics } = load("parse");
const updates = {
  runtimeVersion: "1.5.0",
  updateId: "test-update-id",
  channel: "production",
  isEnabled: true,
  isEmbeddedLaunch: false,
  unexpectedManifest: "never include this",
};

test("support diagnostics redact names, amounts and account numbers but preserve OCR layout clues", () => {
  const lines = [
    { x: 40, y: 100, text: "10월 • 페이머니" },
    { x: 40, y: 200, text: "24일 토요일 -42,000원" },
    {
      x: 160,
      y: 300,
      text: "송금 1 카카오페이머니 → 가상개인명(국민12345678)",
    },
    { x: 160, y: 350, text: "-42,000원" },
    { x: 160, y: 400, text: "王小明 user@example.com" },
  ];
  const diagnostic = createImportDiagnostic(
    lines,
    null,
    updates,
    "no-transactions",
  );
  for (const privateText of [
    "42,000",
    "12345678",
    "가상개인명",
    "국민",
    "王小明",
    "user@example.com",
    "unexpectedManifest",
    "never include this",
  ]) {
    assert.equal(diagnostic.detail.includes(privateText), false, privateText);
  }
  const value = JSON.parse(diagnostic.detail);
  assert.equal(value.updates.updateId, "test-update-id");
  assert.equal(value.shapes[0].text, "00월 • 페이머니");
  assert.equal(value.shapes[3].text, "-00,000원");
  assert.equal(value.shapes[2].x, 160);
  assert.equal(value.counts.payMonths, 1);
  assert.equal(value.counts.payDays, 1);
  assert.equal(maskOcrText("가상인 987원"), maskOcrText("가상인 987원"));
});

test("diagnostics distinguish empty recognition, missing dates and missing won amounts", () => {
  assert.equal(receiptDiagnostics([]).lines, 0);
  const missingDate = receiptDiagnostics([
    { x: 40, y: 100, text: "가상상점 -900원" },
  ]);
  assert.equal(missingDate.amounts, 1);
  assert.equal(missingDate.dates, 0);
  const missingWon = receiptDiagnostics([
    { x: 40, y: 100, text: "10. 25" },
    { x: 160, y: 200, text: "-900" },
  ]);
  assert.equal(missingWon.dates, 1);
  assert.equal(missingWon.amounts, 0);
  const stats = {
    blocks: 2,
    rawLines: 9,
    framedLines: 9,
    validLines: 0,
    frameKeys: ["x", "y"],
  };
  const value = JSON.parse(
    createImportDiagnostic([], stats, updates, "no-transactions").detail,
  );
  assert.equal(value.recognition.rawLines, 9);
  assert.equal(value.recognition.validLines, 0);
});

test("diagnostic payloads are bounded and never contain non-finite coordinates", () => {
  const lines = Array.from({ length: 150 }, () => ({
    x: NaN,
    y: Infinity,
    text: "가".repeat(1000),
  }));
  const value = JSON.parse(
    createImportDiagnostic(lines, null, updates, "no-transactions").detail,
  );
  assert.equal(value.shapes.length, 100);
  assert.ok(
    value.shapes.every(
      (l) => l.x === null && l.y === null && l.text.length <= 200,
    ),
  );
  assert.equal(value.counts.lines, 150);
});

test("the failure sheet shares only masked diagnostics and only after an explicit tap", () => {
  const shared = [];
  const diagnostic = createImportDiagnostic(
    [{ x: 40, y: 100, text: "가상개인명 -42,000원" }],
    null,
    updates,
    "no-transactions",
  );
  const jsx = (type, props) => ({ type, props });
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": { router: { push() {} } },
    "react-native": {
      View: "View",
      Share: {
        share: (value) => {
          shared.push(value);
          return Promise.resolve({});
        },
      },
    },
    "@/components/ui": { Button: "Button", Sheet: "Sheet", T: "T" },
    "@/components/Toast": { useToast: () => () => {} },
    "./receiptImport/useImageImport": {
      imageImportSupported: true,
      useImageImport: () => ({
        error: "읽기 실패",
        diagnostic,
        clearError() {},
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        require.resolve("../src/service/AddTransactionSheet.tsx"),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    { exports, require: (name) => modules[name] },
  );
  const tree = exports.AddTransactionSheet({ visible: false, onClose() {} });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  assert.equal(shared.length, 0);
  nodes
    .find((node) => node.props?.label === "문제 확인 정보 공유")
    .props.onPress();
  assert.equal(shared.length, 1);
  assert.equal(shared[0].message, diagnostic.detail);
  assert.equal(shared[0].message.includes("가상개인명"), false);
  assert.equal(shared[0].message.includes("42,000"), false);
});
