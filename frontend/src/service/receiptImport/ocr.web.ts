import type { OcrLine } from "./parse";
// 기기 안 글자 읽기(ML Kit)는 앱에서만 쓸 수 있다.
export const imageImportSupported = false;
export const getLastRecognitionStats = () => null;
export async function pickAndRecognize(): Promise<OcrLine[] | null> {
  throw new Error("이미지 가져오기는 앱에서만 쓸 수 있어요");
}
