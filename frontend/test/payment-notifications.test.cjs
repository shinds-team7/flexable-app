const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const cache = {};
function load(file) {
  file = path.resolve(__dirname, "../src/service", file);
  if (cache[file]) return cache[file];
  const exports = {};
  cache[file] = exports;
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Date,
      require: (name) => load(path.resolve(path.dirname(file), name + ".ts")),
    },
  );
  return exports;
}
const { parseShinhanNotice } = load("paymentNotifications/parse.ts");
const { importPaymentNotices } = load("paymentNotifications/process.ts");
const notice = (
  body = "가*나님\n1,200원 일시불\n10/29 10:00\n가상커피\n누적 50,000원",
) => ({
  id: "a".repeat(64),
  title: "신한카드 승인",
  body,
  postedAt: Date.parse("2026-10-29T10:00:10+09:00"),
  prepared: "",
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Shinhan domestic approval: amount/date/merchant are explicit; customer/card data never becomes the transaction", () => {
  assert.deepEqual(plain(parseShinhanNotice(notice())), {
    approval: {
      title: "가상커피",
      amount: 1200,
      occurredAt: "2026-10-29T10:00:00+09:00",
    },
  });
  const explicit = notice(
    "가*나님\n승인금액: 1,200원\n10/29 10:00\n가맹점: 가상커피\n누적 50,000원",
  );
  assert.equal(parseShinhanNotice(explicit).approval.title, "가상커피");
});

test("cancellation, foreign currency, OTP, missing/ambiguous amounts and invalid dates never auto-save", () => {
  for (const body of [
    notice().body + "\n승인취소",
    notice().body + "\n해외 USD",
    notice().body + "\n인증번호 123456",
    notice().body.replace("1,200원 일시불", "누적 1,200원"),
    notice().body.replace("1,200원", "1,2000원"),
    notice().body + "\n2,000원",
    notice().body.replace("10/29", "02/30"),
    notice().body.replace("10:00", "25:00"),
    notice().body.replace("10/29", "10/10"),
    notice().body.replace("가상커피", "가상커피\n추가 안내"),
  ])
    assert.equal(parseShinhanNotice(notice(body)).approval, undefined, body);
  assert.equal(
    parseShinhanNotice({ ...notice(), title: "승인 안내" }).approval,
    undefined,
  );
});

test("a January notification can refer to a December payment, but never a future or unrelated date", () => {
  const n = {
    ...notice("1,200원\n12/31 23:59\n가상매장"),
    postedAt: Date.parse("2027-01-01T00:00:10+09:00"),
  };
  assert.equal(
    parseShinhanNotice(n).approval.occurredAt,
    "2026-12-31T23:59:00+09:00",
  );
});

function environment() {
  const calls = [];
  let active = true;
  let fail = false;
  let existing = [];
  const prepared = new Map();
  const deps = {
    current: () => active,
    category: async () => 7,
    existing: async () => existing,
    prepare: async (id, body) => {
      calls.push("prepare");
      prepared.set(id, plain(body));
      return body;
    },
    save: async (id, body) => {
      calls.push(["save", id, plain(body)]);
      if (fail) throw Error("response lost");
    },
    acknowledge: async (id) => calls.push(["ack", id]),
  };
  return {
    calls,
    deps,
    prepared,
    set active(v) {
      active = v;
    },
    set fail(v) {
      fail = v;
    },
    set existing(v) {
      existing = v;
    },
  };
}

test("automatic import persists the exact request before sending and acknowledges only after success", async () => {
  const e = environment();
  const result = await importPaymentNotices([notice()], e.deps);
  assert.equal(result.saved, 1);
  assert.equal(e.calls[0], "prepare");
  assert.equal(e.calls[1][0], "save");
  assert.equal(e.calls[2][0], "ack");
  assert.equal(e.calls[1][2].categoryId, 7);
  assert.equal(JSON.stringify(e.calls).includes("가*나"), false);
});

test("lost responses reuse the saved body and identity, without mistaking the accepted transaction for a duplicate", async () => {
  const e = environment();
  e.fail = true;
  await assert.rejects(importPaymentNotices([notice()], e.deps));
  assert.equal(
    e.calls.some((c) => c[0] === "ack"),
    false,
  );
  const body = e.prepared.get(notice().id);
  e.existing = [{ ...body }];
  e.fail = false;
  e.deps.category = async () => {
    throw Error("must keep original category");
  };
  await importPaymentNotices(
    [{ ...notice(), prepared: JSON.stringify(body) }],
    e.deps,
  );
  const saves = e.calls.filter((c) => c[0] === "save");
  assert.deepEqual(saves[0], saves[1]);
  assert.equal(e.calls.at(-1)[0], "ack");
});

test("possible manual/screenshot duplicate or two identical purchases in one minute need confirmation", async () => {
  const e = environment();
  e.existing = [
    {
      type: "EXPENSE",
      amount: 1200,
      title: "가상 커피",
      occurredAt: "2026-10-29T10:00:30+09:00",
    },
  ];
  const result = await importPaymentNotices([notice()], e.deps);
  assert.equal(result.saved, 0);
  assert.equal(result.problems.length, 1);
  assert.equal(e.calls.length, 0);
});

test("account change during lookup cannot prepare, save or acknowledge the previous user's notification", async () => {
  const e = environment();
  e.deps.existing = async () => {
    e.active = false;
    return [];
  };
  await importPaymentNotices([notice()], e.deps);
  assert.equal(e.calls.length, 0);
});

test("unclear/cancelled notices remain pending, and missing default category never picks a random category", async () => {
  const e = environment();
  e.deps.category = async () => null;
  const result = await importPaymentNotices(
    [notice(), notice(notice().body + "\n취소")],
    e.deps,
  );
  assert.equal(result.problems.length, 2);
  assert.equal(e.calls.length, 0);
});

function nativeAdapter() {
  const calls = [];
  const native = {
    clear: async () => {
      calls.push("clear");
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../src/service/paymentNotifications/native.ts",
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, require: () => ({ requireOptionalNativeModule: () => native }) },
  );
  return { ...exports, calls };
}

test("logout cleanup follows an in-flight consent change, so a late native response cannot re-enable collection", async () => {
  const bridge = nativeAdapter();
  let finish;
  const consent = bridge.mutatePaymentCollection(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await new Promise(setImmediate);
  const logout = bridge.clearPaymentNotifications();
  await new Promise(setImmediate);
  assert.deepEqual(bridge.calls, []);
  finish();
  await consent;
  await logout;
  assert.deepEqual(bridge.calls, ["clear"]);
});

test("queued work rechecks its session before it can touch native storage, including after a failed operation", async () => {
  const bridge = nativeAdapter();
  let active = true;
  const stale = bridge.mutatePaymentCollection(
    async () => {
      throw Error("must not execute");
    },
    () => active,
  );
  active = false;
  await assert.rejects(stale, /계정/);
  await bridge.clearPaymentNotifications();
  assert.deepEqual(bridge.calls, ["clear"]);
});

test("disabling collection after request preparation prevents sending it or acknowledging an unsaved item", async () => {
  const e = environment();
  e.deps.prepare = async (id, body) => {
    e.active = false;
    return body;
  };
  await importPaymentNotices([notice()], e.deps);
  assert.equal(e.calls.length, 0);
});
