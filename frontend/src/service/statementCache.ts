import { File } from "expo-file-system";

/** 파일 선택 때 앱 캐시에 복사한 거래내역서 사본을 지운다(개인정보처리방침: 기기에 남기지 않음). */
export function deleteStatementCopy(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // 이미 없거나 지울 수 없으면 시스템이 캐시와 함께 정리한다.
  }
}
