import TextRecognition, {
  TextRecognitionScript,
} from "@react-native-ml-kit/text-recognition";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import type { OcrLine } from "./parse";
export const imageImportSupported = true;
/**
 * 갤러리에서 스크린샷 1장을 골라 기기 안에서 글자를 읽는다. 이미지는 기기 밖으로 나가지 않고,
 * 고르는 과정에서 생긴 임시 파일은 읽은 뒤 바로 지운다. 취소하면 null.
 */
export async function pickAndRecognize(): Promise<OcrLine[] | null> {
  // 시스템 사진 선택 화면을 쓰므로 사진 권한을 따로 받지 않는다.
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const uri = picked.assets[0].uri;
  try {
    const result = await TextRecognition.recognize(
      uri,
      TextRecognitionScript.KOREAN,
    );
    return result.blocks
      .flatMap((b) => b.lines)
      .filter((l) => l.frame)
      .map((l) => ({
        text: l.text.trim(),
        x: l.frame!.left,
        y: l.frame!.top + l.frame!.height / 2,
      }))
      .filter((l) => l.text);
  } finally {
    try {
      new File(uri).delete();
    } catch {
      // 이미 없거나 지울 수 없는 파일이면 시스템이 캐시와 함께 정리한다.
    }
  }
}
