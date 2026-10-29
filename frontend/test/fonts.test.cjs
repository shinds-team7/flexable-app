const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTheme(os) {
  const source = fs.readFileSync(path.join(__dirname, '../src/theme/index.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: () => ({
    Platform: { OS: os, select: (options) => options[os] ?? options.default },
    Easing: { bezier: () => () => {} },
  }) };
  vm.runInNewContext(js, context);
  return context.exports;
}

test('native weights select bundled fonts instead of system fonts or synthetic bold', () => {
  for (const os of ['android', 'ios']) {
    const { font, fontStyle } = loadTheme(os);
    assert.equal(font, 'Pretendard-Regular');
    for (const [weight, face] of [
      ['400', 'Regular'], ['500', 'Medium'], ['600', 'SemiBold'],
      ['700', 'Bold'], ['800', 'ExtraBold'], ['bold', 'Bold'],
      [700, 'Bold'], [undefined, 'Regular'],
    ]) {
      const style = fontStyle(weight);
      assert.equal(style.fontFamily, `Pretendard-${face}`);
      assert.equal(style.fontWeight, 'normal');
      const file = fs.readFileSync(path.join(__dirname, `../assets/fonts/${style.fontFamily}.otf`));
      assert.equal(file.subarray(0, 4).toString(), 'OTTO');
    }
  }
});

test('web keeps the existing CSS font family and requested weight', () => {
  const { font, fontStyle } = loadTheme('web');
  assert.match(font, /Pretendard Variable/);
  assert.equal(fontStyle('800').fontFamily, font);
  assert.equal(fontStyle('800').fontWeight, '800');
});
