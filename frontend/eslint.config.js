// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    files: ["src/service/**/*.{ts,tsx}", "src/app/(service)/**/*.{ts,tsx}", "src/app/auth/**/*.{ts,tsx}", "src/app/onboarding/**/*.{ts,tsx}", "src/app/{index,privacy,terms,support,delete-account}.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/data/mock", "@/store/AppStore", "@/ai", "@/ai/*"], message: "서비스 화면은 실제 API와 서비스 세션만 사용합니다." }] }],
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
