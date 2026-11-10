const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('앱 진입점은 Router가 첫 화면을 만들기 전에 스플래시 자동 숨김을 막는다', () => {
  const root = path.join(__dirname, '..');
  const entry = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).main;
  const calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, entry), 'utf8'), {
    require(name) {
      if (name === 'expo-splash-screen') {
        return { preventAutoHideAsync() {
          calls.push('prevent');
          return Promise.resolve(true);
        } };
      }
      assert.equal(name, 'expo-router/entry');
      assert.deepEqual(calls, ['prevent']);
      calls.push('router');
    },
  });
  assert.deepEqual(calls, ['prevent', 'router']);
});
