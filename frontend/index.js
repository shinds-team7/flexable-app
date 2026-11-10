// 화면 모듈을 읽기 전에 실행해야 첫 화면의 자동 숨김보다 먼저 등록된다.
// import는 실행 순서가 끌어올려지므로 Router는 마지막에 require한다.
const SplashScreen = require('expo-splash-screen');

SplashScreen.preventAutoHideAsync().catch(() => {});

require('expo-router/entry');
