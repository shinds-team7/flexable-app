// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // 시연(src/demo, src/app/demo)은 서비스·공통 코드를 써도 되지만, 그 반대는 안 된다.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/demo/**", "src/app/demo/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ regex: "^(@/(app/)?demo|(\.\.?/)+(app/)?demo)(/|$)", message: "서비스·공통 코드는 시연 코드(src/demo)를 import하지 않습니다." }] }],
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
