const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Mount the real setting hook with deferred storage, as during an app update/startup.
function mount(saved) {
  let resolveRead, value, change;
  const writes = [];
  const pending = new Promise(resolve => { resolveRead = resolve; });
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/service/reminderSetting.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    exports: module.exports,
    require(name) {
      if (name === 'react') return {
        useState(initial) { value = initial; return [value, next => { value = next; }]; },
        useEffect(fn) { fn(); },
      };
      if (name === './storage') return {
        readStorage: () => pending,
        writeStorage: async (key, next) => { writes.push([key, next]); },
      };
      throw new Error(name);
    },
  });
  return {
    use(name = 'useBudgetNotificationSetting') {
      [, change] = module.exports[name]();
      return value;
    },
    get value() { return value; },
    change: next => change(next),
    async restore() { resolveRead(saved); await pending; await Promise.resolve(); },
    writes,
  };
}

test('an update with no saved budget notification choice stays off', async () => {
  const app = mount(null);
  assert.equal(app.use(), false);
  await app.restore();
  assert.equal(app.value, false);
  assert.deepEqual(app.writes, []);
});

for (const [saved, expected] of [['on', true], ['off', false]]) {
  test(`an update preserves the explicit ${saved} budget notification choice`, async () => {
    const app = mount(saved);
    app.use(); await app.restore();
    assert.equal(app.value, expected);
    assert.deepEqual(app.writes, []);
  });
}

test('a late storage read cannot undo a direct choice and the choice persists for other mounts', async () => {
  const app = mount(null);
  app.use(); app.change(true); await app.restore();
  assert.equal(app.value, true);
  assert.equal(app.use(), true);
  assert.deepEqual(app.writes, [['flexable.service.budgetNotification', 'on']]);
});

test('seed and entry reminders keep their existing default', async () => {
  for (const name of ['useSeedReminderSetting', 'useEntryReminderSetting']) {
    const app = mount(null);
    assert.equal(app.use(name), true);
    await app.restore();
    assert.equal(app.value, true);
  }
});
