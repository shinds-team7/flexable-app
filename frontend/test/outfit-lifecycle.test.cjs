// Executes the real component with native-like release semantics. This is not a device test.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadOutfit() {
  const players = [];
  let focused = true;
  let reduced = false;
  let cleanups;
  const element = (type, props, key) => ({ type, props, key });
  const modules = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    react: {
      useEffect: (effect) => {
        cleanups.push(effect());
      },
      useState: (initial) => [initial, () => {}],
      useCallback: (fn) => fn,
    },
    "react-native": {
      View: "View",
      Platform: { OS: "android" },
      StyleSheet: { create: (styles) => styles, absoluteFill: {} },
    },
    "expo-image": { Image: "Image" },
    "expo-router": {
      useIsFocused: () => focused,
      useFocusEffect: (effect) => {
        cleanups.push(effect());
      },
    },
    "@/components/ui": { useReducedMotion: () => reduced },
    "./outfits": {
      outfitSource: (id) => `poster:${id}`,
      outfitVideo: (id) => (id === "missing" ? null : id),
    },
    "expo-video": {
      VideoView: "VideoView",
      useVideoPlayer: (source, setup) => {
        const player = {
          source,
          released: false,
          playing: false,
          play() {
            assert.equal(
              this.released,
              false,
              "play called after native release",
            );
            this.playing = true;
          },
          pause() {
            assert.equal(
              this.released,
              false,
              "pause called after native release",
            );
            this.playing = false;
          },
        };
        players.push(player);
        setup(player);
        // Expo's hook registers its cleanup before the component's later effects.
        cleanups.push(() => {
          player.released = true;
          player.playing = false;
        });
        return player;
      },
    },
  };
  const source = fs.readFileSync(
    require.resolve("../src/service/OutfitView.tsx"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => {
      assert.ok(modules[id], `Unexpected import: ${id}`);
      return modules[id];
    },
  };
  vm.runInNewContext(js, context);
  function renderNode(node) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(renderNode);
    if (typeof node.type === "function")
      return renderNode(node.type(node.props));
    return {
      ...node,
      props: { ...node.props, children: renderNode(node.props?.children) },
    };
  }
  return {
    players,
    focus: (value) => {
      focused = value;
    },
    reducedMotion: (value) => {
      reduced = value;
    },
    mount: (props) => {
      cleanups = [];
      const tree = renderNode(context.exports.OutfitView(props));
      const registered = cleanups;
      return {
        tree,
        unmount: () => registered.forEach((cleanup) => cleanup?.()),
      };
    },
  };
}

test("switching costumes and leaving the screen never calls an already released native player", () => {
  const view = loadOutfit();
  for (const outfitId of ["miner", "jackpot", "salary", "miner", "salary"]) {
    const mounted = view.mount({ outfitId });
    const player = view.players.at(-1);
    assert.equal(player.playing, true);
    assert.equal(player.muted, true);
    assert.equal(player.loop, true);
    assert.doesNotThrow(mounted.unmount);
    assert.equal(player.released, true);
  }
});

test("a covered screen has no player; returning creates a fresh playing instance", () => {
  const view = loadOutfit();
  const home = view.mount({ outfitId: "salary" });
  const original = view.players[0];
  home.unmount();
  view.focus(false);
  const covered = view.mount({ outfitId: "salary" });
  assert.equal(view.players.length, 1);
  assert.equal(covered.tree.props.children.type, "Image");
  covered.unmount();
  view.focus(true);
  const returned = view.mount({ outfitId: "salary" });
  assert.equal(view.players.length, 2);
  assert.notEqual(view.players[1], original);
  assert.equal(original.released, true);
  assert.equal(view.players[1].playing, true);
  returned.unmount();
});

test("shop thumbnails, reduced motion and unavailable videos use posters without players", () => {
  const view = loadOutfit();
  view.mount({ outfitId: "salary", play: false }).unmount();
  view.mount({ outfitId: "missing" }).unmount();
  view.reducedMotion(true);
  view.mount({ outfitId: "salary" }).unmount();
  assert.equal(view.players.length, 0);
});
