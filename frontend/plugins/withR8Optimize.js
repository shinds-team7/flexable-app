// Play vitals "R8 최적화로 앱의 메모리 및 성능 개선": Expo 템플릿의 release 빌드는
// proguard-android.txt를 쓰는데, 이 파일에 -dontoptimize가 들어 있어 R8이 코드를 줄이기만 하고
// 인라인·클래스 병합 같은 최적화는 하지 않는다. optimize 버전으로 바꿔 최적화를 켠다.
// 라이브러리 keep 규칙은 각 라이브러리의 consumer rules가 그대로 적용된다.
const { withAppBuildGradle } = require("expo/config-plugins");

const FROM = 'getDefaultProguardFile("proguard-android.txt")';
const TO = 'getDefaultProguardFile("proguard-android-optimize.txt")';

module.exports = function withR8Optimize(config) {
  return withAppBuildGradle(config, (config) => {
    const src = config.modResults.contents;
    if (src.includes(TO)) return config;
    if (!src.includes(FROM)) {
      throw new Error(
        "withR8Optimize: app/build.gradle에서 proguard-android.txt 줄을 찾지 못했다. Expo 템플릿이 바뀌었는지 확인한다.",
      );
    }
    config.modResults.contents = src.replace(FROM, TO);
    return config;
  });
};
