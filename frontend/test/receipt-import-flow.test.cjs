// Exercises the actual review screen with deferred resource and save results.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function reviewScreen() {
  const slots = [];
  let cursor = 0;
  let nextId = 0;
  let navigated = false;
  const requests = [];
  const existing = {
    loading: true,
    data: undefined,
    error: undefined,
    retry() {},
  };
  const element = (type, props) => ({ type, props });
  const candidate = {
    date: "2026-10-26",
    title: "CU",
    amount: 6800,
    type: "EXPENSE",
    balance: null,
    ownTransfer: false,
    refund: false,
    review: [],
  };
  const categories = {
    loading: false,
    error: undefined,
    retry() {},
    data: [{ id: 1, name: "기타", icon: "cart", color: "#000" }],
  };
  const modules = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots))
          slots[index] = typeof initial === "function" ? initial() : initial;
        return [
          slots[index],
          (value) => {
            assert.equal(navigated, false, "state changed after navigation");
            slots[index] =
              typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useMemo: (fn) => fn(),
    },
    "react-native": {
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      View: "View",
    },
    "@expo/vector-icons/Ionicons": { default: "Icon", __esModule: true },
    "expo-crypto": { randomUUID: () => String(++nextId) },
    "@/components/ui": {
      Button: "Button",
      Card: "Card",
      Segment: "Segment",
      Sheet: "Sheet",
      T: "T",
    },
    "@/components/Toast": { useToast: () => () => {} },
    "@/components/SubHeader": {
      goBack: () => {
        navigated = true;
      },
    },
    "@/theme": { colors: {}, radius: {} },
    "./api/client": {
      api: (path, options) =>
        new Promise((resolve, reject) =>
          requests.push({ path, options, resolve, reject }),
        ),
    },
    "./DateField": { DateField: "DateField" },
    "./receiptImport/store": {
      getPending: () => [candidate],
      clearPending() {},
    },
    "./Session": { useSession: () => ({ invalidate() {} }) },
    "./ui": {
      CategoryIcon: "CategoryIcon",
      ErrorNotice: "ErrorNotice",
      Field: "Field",
      Loading: "Loading",
      Page: "Page",
      money: String,
      digits: (s) => s.replace(/\D/g, ""),
      useResource: (path) =>
        path?.startsWith("/categories") ? categories : existing,
    },
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const exports = {};
    cache[file] = exports;
    const source = fs.readFileSync(
      require.resolve(`../src/service/${file}`),
      "utf8",
    );
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
      {
        exports,
        Date,
        Error,
        require: (name) => {
          if (name in modules) return modules[name];
          return load(name.slice(2) + ".ts");
        },
      },
    );
    return exports;
  }
  const { ImportReview } = load("ImportReview.tsx");
  function render() {
    cursor = 0;
    const component = ImportReview();
    return component.type(component.props);
  }
  return {
    existing,
    requests,
    candidate,
    render,
    get navigated() {
      return navigated;
    },
  };
}

test("review waits for duplicate lookup and blocks saving when the lookup fails", async () => {
  const screen = reviewScreen();
  let button = screen.render().props.footer.props;
  assert.equal(button.disabled, true);
  await button.onPress();
  assert.equal(screen.requests.length, 0);
  screen.existing.loading = false;
  screen.existing.error = new Error("offline");
  button = screen.render().props.footer.props;
  assert.equal(button.disabled, true);
  await button.onPress();
  assert.equal(screen.requests.length, 0);
  screen.existing.error = undefined;
  screen.existing.data = { items: [] };
  assert.equal(screen.render().props.footer.props.disabled, false);
});

test("an existing matching transaction is excluded before any save", () => {
  const screen = reviewScreen();
  screen.existing.loading = false;
  screen.existing.data = {
    items: [{ ...screen.candidate, occurredAt: "2026-10-26T12:00:00+09:00" }],
  };
  assert.equal(screen.render().props.footer.props.disabled, true);
});

test("a network retry sends the original body and idempotency key and stays locked on success", async () => {
  const screen = reviewScreen();
  screen.existing.loading = false;
  screen.existing.data = { items: [] };
  const saving = screen.render().props.footer.props.onPress();
  assert.equal(screen.requests.length, 1);
  const first = screen.requests[0];
  first.reject(Object.assign(new Error("offline"), { code: "NETWORK" }));
  await saving;
  assert.equal(screen.navigated, false);
  // The server may have saved the first request before its response was lost.
  screen.existing.data = {
    items: [{ ...screen.candidate, occurredAt: "2026-10-26T12:00:00+09:00" }],
  };
  const button = screen.render().props.footer.props;
  assert.equal(button.disabled, false);
  const retry = button.onPress();
  assert.equal(screen.requests.length, 2);
  assert.equal(screen.requests[1].options.body, first.options.body);
  assert.equal(screen.requests[1].options.key, first.options.key);
  screen.requests[1].resolve({});
  await retry;
  assert.equal(screen.navigated, true);
  assert.equal(screen.render().props.footer.props.disabled, true);
});

test("image import prevents double taps, avoids state changes after navigation and unlocks on return", async () => {
  const slots = [];
  let cursor = 0;
  let navigated = false;
  let focused;
  const pickers = [];
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value) => {
            assert.equal(navigated, false, "state changed after navigation");
            slots[index] = value;
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        return (slots[index] ??= { current: initial });
      },
      useCallback: (fn) => fn,
    },
    "expo-router": {
      router: {
        push: () => {
          navigated = true;
        },
      },
      useFocusEffect: (effect) => {
        focused = effect;
      },
    },
    "../ui": { seoulDate: () => "2026-10-27" },
    "./ocr": {
      imageImportSupported: true,
      pickAndRecognize: () => new Promise((resolve) => pickers.push(resolve)),
    },
    "./parse": { parseReceipt: () => ({ items: [{ title: "CU" }] }) },
    "./store": { setPending() {} },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        require.resolve("../src/service/receiptImport/useImageImport.ts"),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      require: (name) => modules[name],
    },
  );
  const render = () => {
    cursor = 0;
    return exports.useImageImport();
  };
  const hook = render();
  const first = hook.start();
  await hook.start();
  assert.equal(pickers.length, 1);
  pickers[0]([{ text: "CU" }]);
  await first;
  assert.equal(navigated, true);
  assert.equal(render().busy, true);
  navigated = false;
  focused();
  const returned = render();
  assert.equal(returned.busy, false);
  const cancelled = returned.start();
  assert.equal(pickers.length, 2);
  pickers[1](null);
  await cancelled;
  assert.equal(render().busy, false);
});
