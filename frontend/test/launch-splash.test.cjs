const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real component with a deterministic clock and native events. Native hide is deliberately a no-op.
function mount() {
  let cursor = 0, dirty = false, now = 0, nextId = 0, tree, listener;
  let settled = true, minimumCalls = 0;
  const slots = [], pending = [], timers = new Map();
  const props = { appReady: false, onMinimumShown: () => minimumCalls++ };
  const schedule = (fn, delay) => { const id = ++nextId; timers.set(id, { at: now + delay, fn }); return id; };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { if (slots[i].value !== value) { slots[i].value = value; dirty = true; } }];
    },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((d, n) => !Object.is(d, previous.deps[n]))) {
        pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const context = {
    exports: {}, setTimeout: schedule, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => schedule(fn, 16), cancelAnimationFrame: id => timers.delete(id),
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === 'react-native') return {
        Modal: 'Modal', View: 'View', Image: 'Image', Text: 'Text', StyleSheet: { create: x => x },
        AppState: { currentState: 'active', addEventListener: (_, fn) => { listener = fn; return { remove: () => { listener = null; } }; } },
      };
      if (name === 'expo-splash-screen') return { hideAsync: () => Promise.resolve() };
      if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
      if (name === './LaunchUpdate') return { useLaunchUpdateSettled: () => settled };
      if (name.endsWith('.png')) return name;
      throw Error(name);
    },
  };
  const source = fs.readFileSync(require.resolve('../src/service/LaunchSplash.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context);
  function render() {
    do { dirty = false; cursor = 0; tree = context.exports.LaunchSplash(props); while (pending.length) pending.shift()(); } while (dirty);
  }
  function advance(ms) {
    const target = now + ms;
    while (true) {
      const next = [...timers.entries()].sort((a,b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn(); render();
    }
    now = target;
  }
  const logo = () => tree.props.children.props.children.find(x => x?.type === 'Image');
  render();
  return {
    get tree() { return tree; }, get minimumCalls() { return minimumCalls; }, advance,
    show() { tree.props.onShow(); render(); }, load() { logo().props.onLoad(); render(); },
    imageError() { logo().props.onError(); render(); },
    appReady() { props.appReady = true; render(); },
    updateReady(value) { settled = value; render(); },
    state(value) { listener(value); render(); },
    unmount() { slots.forEach(x => x?.cleanup?.()); },
  };
}

test('even if native splash is already gone, the app screen remains for a full second after show and image load', () => {
  const app = mount();
  app.appReady(); app.advance(5000);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 0);
  app.show(); app.advance(5000);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 0);
  app.load(); app.advance(1015);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 0);
  app.advance(1);
  assert.equal(app.tree, null); assert.equal(app.minimumCalls, 1);
});

test('session restore and update download cannot reveal the app before their ready signals', () => {
  const app = mount();
  app.updateReady(false); app.show(); app.load(); app.advance(2000);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 0);
  app.updateReady(true);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 1);
  app.appReady(); assert.equal(app.tree, null);
});

test('time spent in background does not count as visible splash time', () => {
  const app = mount(); app.appReady(); app.show(); app.load(); app.advance(700);
  app.state('background'); app.advance(10000);
  assert.ok(app.tree); assert.equal(app.minimumCalls, 0);
  app.state('active'); app.advance(1015); assert.ok(app.tree);
  app.advance(1); assert.equal(app.tree, null);
});

test('a failed local image shows fallback then releases, and unmount cancels the timer', () => {
  const app = mount(); app.appReady(); app.show(); app.imageError();
  assert.equal(app.tree.props.children.props.children[1].type, 'Text');
  app.advance(1016); assert.equal(app.tree, null);
  const stopped = mount(); stopped.show(); stopped.load(); stopped.advance(200); stopped.unmount(); stopped.advance(2000);
  assert.equal(stopped.minimumCalls, 0);
});
