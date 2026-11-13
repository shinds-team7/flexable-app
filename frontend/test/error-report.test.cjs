// Runs the real src/service/errorReportRules.ts (transpiled).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/errorReportRules.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const context = { exports: {}, Set };
  vm.runInNewContext(js, context);
  return context.exports;
}
const { shouldReportApi, reportKey, cleanPath, cut } = load();

test("unexpected server answers are reported, expected ones and logouts are not", () => {
  // The Shinhan auto-record bug: a 400 the user never caused
  assert.equal(shouldReportApi(400, "VALIDATION_FAILED"), true);
  assert.equal(shouldReportApi(500, "INTERNAL_ERROR"), true);
  assert.equal(shouldReportApi(502, "CHAT_FAILED"), true);
  // 앱이 기다리다 끊은 경우(status 0)는 서버·AI가 느린 신호라 기록한다
  assert.equal(shouldReportApi(0, "TIMEOUT"), true);
  assert.equal(shouldReportApi(0, undefined), false);
  assert.equal(shouldReportApi(404, "NOT_FOUND"), true);
  assert.equal(shouldReportApi(503, undefined), true);
  assert.equal(shouldReportApi(401, "UNAUTHORIZED"), false);
  assert.equal(shouldReportApi(409, "COINS_NOT_ENOUGH"), false);
  assert.equal(shouldReportApi(409, "AD_NOT_REWARDED"), false);
  assert.equal(shouldReportApi(429, "TOO_MANY_ATTEMPTS"), false);
  assert.equal(shouldReportApi(503, "CHAT_UNAVAILABLE"), false);
  assert.equal(shouldReportApi(200, undefined), false);
});

test("queries are dropped and the same error has the same key", () => {
  assert.equal(
    cleanPath("/api/v1/transactions?from=2026-11-01&to=2026-11-07"),
    "/api/v1/transactions",
  );
  const a = reportKey({
    kind: "API",
    status: 400,
    code: "VALIDATION_FAILED",
    method: "POST",
    path: "/api/v1/transactions?x=1",
    message: "요청 키가 너무 길어요",
  });
  const b = reportKey({
    kind: "API",
    status: 400,
    code: "VALIDATION_FAILED",
    method: "POST",
    path: "/api/v1/transactions",
    message: "요청 키가 너무 길어요",
  });
  assert.equal(a, b);
  assert.notEqual(
    a,
    reportKey({ kind: "JS", message: "요청 키가 너무 길어요" }),
  );
  assert.equal(cut("가".repeat(10), 3), "가가가");
  assert.equal(cut(undefined, 3), undefined);
});
