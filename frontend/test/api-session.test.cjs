// Runs the real src/service/api/client.ts (transpiled) with a controllable fetch.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadClient() {
  const source = fs.readFileSync(
    require.resolve("../src/service/api/client.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const pending = [];
  const context = {
    exports: {},
    process: { env: { EXPO_PUBLIC_API_URL: "https://example.invalid" } },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: () => new Promise((resolve) => pending.push(resolve)),
  };
  vm.runInNewContext(js, context);
  const unauthorized = () =>
    pending.shift()({
      status: 401,
      ok: false,
      json: async () => ({ code: "UNAUTHORIZED" }),
    });
  return { ...context.exports, unauthorized };
}

test("a late 401 for the previous session does not expire the new one", async () => {
  const { api, setApiSession, unauthorized } = loadClient();
  let expiredOld = 0;
  let expiredNew = 0;
  setApiSession("old-token", async () => expiredOld++);
  const request = api("/me").catch((e) => e.code);
  setApiSession(null);
  setApiSession("new-token", async () => expiredNew++);
  unauthorized();
  assert.equal(await request, "UNAUTHORIZED");
  assert.equal(expiredOld, 0);
  assert.equal(expiredNew, 0);
});

test("a 401 for the current session expires it once even if several requests fail", async () => {
  const { api, setApiSession, unauthorized } = loadClient();
  let expired = 0;
  setApiSession("token", async () => {
    expired++;
    setApiSession(null);
  });
  const first = api("/me").catch((e) => e.code);
  const second = api("/budget/today").catch((e) => e.code);
  unauthorized();
  assert.equal(await first, "UNAUTHORIZED");
  unauthorized();
  assert.equal(await second, "UNAUTHORIZED");
  assert.equal(expired, 1);
});

test("sessionGeneration changes on every login and logout", () => {
  const { setApiSession, sessionGeneration } = loadClient();
  const start = sessionGeneration();
  setApiSession("a");
  setApiSession(null);
  setApiSession("b");
  assert.equal(sessionGeneration(), start + 3);
});
