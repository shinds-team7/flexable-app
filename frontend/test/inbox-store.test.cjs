const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real storage queue with isolated device storage and SecureStore's size limit.
function loadStore(saved = new Map()) {
  const modules = {};
  function load(name) {
    if (modules[name]) return modules[name];
    const source = fs.readFileSync(
      require.resolve(`../src/service/${name}.ts`),
      "utf8",
    );
    const js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    const context = {
      exports: {},
      require: (path) => {
        if (path === "react") return {};
        if (path === "./storage")
          return {
            readStorage: async (key) => saved.get(key) ?? null,
            writeStorage: async (key, value) => {
              if (value === null) saved.delete(key);
              else {
                assert.ok(Buffer.byteLength(value, "utf8") <= 2048);
                saved.set(key, value);
              }
            },
          };
        if (path === "./inboxRecords") return load("inboxRecords");
        throw new Error(`Unexpected import: ${path}`);
      },
    };
    vm.runInNewContext(js, context);
    modules[name] = context.exports;
    return context.exports;
  }
  return { ...load("inboxStore"), saved };
}

test("concurrent taps persist individually across restart and are isolated by user", async () => {
  const store = loadStore();
  const at = Date.now();
  await Promise.all([
    store.markInboxItemRead(1, { key: "coin:1", at }),
    store.markInboxItemRead(1, { key: "coin:2", at }),
    store.markInboxItemRead(1, { key: "coin:1", at }),
  ]);
  const restarted = loadStore(store.saved);
  assert.deepEqual(
    Array.from((await restarted.readInbox(1)).read, (r) => r.key),
    ["coin:1", "coin:2"],
  );
  assert.equal((await restarted.readInbox(2)).read.length, 0);
  assert.equal((await restarted.readInbox(1)).seen, 0);
});

test("many receipts stay under each storage limit and logout removes all pages for that user", async () => {
  const store = loadStore();
  const at = Date.now();
  for (let i = 0; i < 80; i++) {
    await store.markInboxItemRead(1, { key: `budget:2026-10-${i}:false`, at });
  }
  await store.markInboxItemRead(2, { key: "coin:1", at });
  assert.equal((await store.readInbox(1)).read.length, 80);
  await store.clearInbox(1);
  assert.equal((await store.readInbox(1)).read.length, 0);
  assert.ok(
    [...store.saved.keys()].every(
      (key) => !key.startsWith("flexable.service.inbox.1."),
    ),
  );
  assert.equal((await store.readInbox(2)).read.length, 1);
});

test("legacy read timestamp survives and expired receipts are pruned on the next tap", async () => {
  const saved = new Map([["flexable.service.inbox.1.seen", "100"]]);
  const store = loadStore(saved);
  await store.markInboxItemRead(1, {
    key: "coin:old",
    at: Date.now() - 31 * 86400000,
  });
  await store.markInboxItemRead(1, { key: "coin:new", at: Date.now() });
  const inbox = await store.readInbox(1);
  assert.equal(inbox.seen, 100);
  assert.deepEqual(
    Array.from(inbox.read, (r) => r.key),
    ["coin:new"],
  );
});
