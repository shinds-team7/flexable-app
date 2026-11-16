// Runs the real src/service/statementForm.ts through Expo's real expo/fetch FormData converter
// (node_modules/expo/src/winter/fetch/convertFormData.ts), which is what the app's global fetch uses on Android.
// Regression: the RN-style { uri, name, type } part made the converter throw, and the app showed a connection error.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, requireStub) {
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const context = {
    exports: {},
    require: requireStub,
    FormData: ExpoLikeFormData,
    Blob,
    TextEncoder,
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(js, context);
  return context.exports;
}

/** Expo's patched FormData keeps [name, value] pairs and exposes entries() */
class ExpoLikeFormData {
  constructor() {
    this.parts = [];
  }
  append(name, value) {
    this.parts.push([name, value]);
  }
  entries() {
    return this.parts;
  }
}

const PDF = new TextEncoder().encode("%PDF-1.7 fake");

/** expo-file-system File: name·type getters and bytes() like the native class */
class FakeFile {
  constructor(uri) {
    this.uri = uri;
  }
  get name() {
    return this.uri.split("/").pop();
  }
  get type() {
    return "application/pdf";
  }
  async bytes() {
    return PDF;
  }
}

const { convertFormDataAsync } = load(
  require.resolve("expo/src/winter/fetch/convertFormData.ts"),
  () => ({ blobToArrayBufferAsync: (b) => b.arrayBuffer() }),
);
const { statementForm } = load(
  require.resolve("../src/service/statementForm.ts"),
  (id) => {
    assert.equal(id, "expo-file-system");
    return { File: FakeFile };
  },
);

const URI = "file:///data/user/0/app/cache/DocumentPicker/abc.pdf";

test("RN-style { uri } part is rejected by expo/fetch (the original bug)", async () => {
  const body = new ExpoLikeFormData();
  body.append("file", { uri: URI, name: "s.pdf", type: "application/pdf" });
  await assert.rejects(
    convertFormDataAsync(body, "B"),
    /Unsupported FormDataPart implementation/,
  );
});

test("app form sends the PDF bytes and password through expo/fetch", async () => {
  const form = statementForm({ uri: URI, name: "내역서.pdf" }, "123456");
  const { body } = await convertFormDataAsync(form, "B");
  const text = new TextDecoder().decode(body);
  assert.match(text, /name="file"; filename="abc\.pdf"/);
  assert.match(text, /content-type: application\/pdf/);
  assert.ok(text.includes("%PDF-1.7 fake"));
  assert.match(text, /name="password"\r\n\r\n123456\r\n/);
});

test("web keeps the picked File as is and omits an empty password", async () => {
  const file = new Blob([PDF], { type: "application/pdf" });
  const form = statementForm({ uri: "blob:x", name: "s.pdf", file }, "");
  assert.equal(form.parts.length, 1);
  assert.equal(form.parts[0][1], file);
});
