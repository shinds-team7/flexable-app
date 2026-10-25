// 스플래시 하단 브랜딩 문구(solpa). expo-splash-screen은 가운데 이미지만 지원해서
// Android 12+ 스플래시의 windowSplashScreenBrandingImage(200×80dp)를 직접 붙인다.
// Android 11 이하는 기본 스플래시라 문구 없이 가운데 이미지만 보인다.
// app.json plugins에서 expo-splash-screen보다 앞에 둔다: mod는 나중에 등록된 것부터 실행되므로,
// 앞에 있어야 expo-splash-screen이 만든 Theme.App.SplashScreen에 항목을 더할 수 있다.
const fs = require("fs");
const path = require("path");
const {
  withAndroidStyles,
  withDangerousMod,
} = require("expo/config-plugins");

const DRAWABLE = "splashscreen_branding";
const ATTR = "android:windowSplashScreenBrandingImage";

/** @param {{ image: string }} props image: 600×240px(xxhdpi 기준 200×80dp) PNG */
module.exports = function withSplashBranding(config, { image }) {
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/drawable-xxhdpi",
      );
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.copyFile(
        path.resolve(config.modRequest.projectRoot, image),
        path.join(dir, `${DRAWABLE}.png`),
      );
      return config;
    },
  ]);

  return withAndroidStyles(config, (config) => {
    const style = config.modResults.resources.style?.find(
      ({ $ }) => $.name === "Theme.App.SplashScreen",
    );
    if (!style) {
      throw new Error(
        "withSplashBranding: Theme.App.SplashScreen이 없다. app.json에서 expo-splash-screen보다 앞에 두었는지 확인한다.",
      );
    }
    style.item = [
      ...(style.item ?? []).filter(({ $ }) => $.name !== ATTR),
      { $: { name: ATTR }, _: `@drawable/${DRAWABLE}` },
    ];
    return config;
  });
};
