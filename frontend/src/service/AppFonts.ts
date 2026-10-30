import { useFonts } from "expo-font";

// 번들에 포함해 기기 글꼴 설정·네트워크에 영향받지 않게 한다. 라이선스: assets/fonts/OFL.txt.
export function useAppFonts() {
  return useFonts({
    "Pretendard-Regular": require("../../assets/fonts/Pretendard-Regular.otf"),
    "Pretendard-Medium": require("../../assets/fonts/Pretendard-Medium.otf"),
    "Pretendard-SemiBold": require("../../assets/fonts/Pretendard-SemiBold.otf"),
    "Pretendard-Bold": require("../../assets/fonts/Pretendard-Bold.otf"),
    "Pretendard-ExtraBold": require("../../assets/fonts/Pretendard-ExtraBold.otf"),
  });
}
