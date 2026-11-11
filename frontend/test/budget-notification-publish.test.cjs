const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function publisher(native) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/service/budgetNotification.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => native };
      return {};
    },
  });
  return exports.publishBudgetNotification;
}

const today = { date: '2026-11-11', dailyBudget: 40000, todaySpent: 5000,
  todayAvailable: 35000, dayBudgets: [40000, 40000, 40000, 40000, 40000, 40000, 40000], weekAvailable: 95000 };

test('installed 2.0.1 uses the working collapsed notification even when updateExpanded exists', async () => {
  let actual;
  const publish = publisher({
    update: async (...args) => { actual = args; return true; },
    updateExpanded: () => { throw new Error('broken 2.0.1 layout must not be used'); },
  });
  assert.equal(await publish(today), true);
  assert.deepEqual(actual, [today.date, 40000, 5000, 35000, today.dayBudgets]);
});

test('a native build with the layout fix receives both server amounts', async () => {
  let actual;
  const publish = publisher({
    supportsExpandedLayout: () => true,
    update: () => { throw new Error('fixed build supports the expanded layout'); },
    updateExpanded: async (...args) => { actual = args; return true; },
  });
  assert.equal(await publish(today), true);
  assert.deepEqual(actual, [today.date, 40000, 5000, 35000, today.dayBudgets, 95000]);
});

test('an old or missing native module remains compatible', async () => {
  assert.equal(publisher(null)(today), undefined);
  assert.equal(await publisher({ update: async () => false })(today), false);
});
