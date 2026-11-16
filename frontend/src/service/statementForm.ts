import { File } from "expo-file-system";

/** 거래내역서 업로드에 필요한 선택 결과(DocumentPickerAsset의 일부) */
export type PickedPdf = { uri: string; name: string; file?: Blob };

/**
 * 거래내역서 업로드 본문(multipart). 웹은 고른 File을 그대로 싣는다.
 * 앱은 Expo 57의 전역 fetch(expo/fetch)가 RN식 { uri, name, type } 파트를 보내지 못하고
 * "Unsupported FormDataPart implementation"으로 실패하므로(앱에는 연결 오류로 보였다),
 * bytes()가 있는 expo-file-system File로 넘긴다.
 */
export function statementForm(pdf: PickedPdf, password: string) {
  const body = new FormData();
  if (pdf.file) body.append("file", pdf.file, pdf.name);
  else
    body.append(
      "file",
      new File(pdf.uri) as unknown as Blob,
      pdf.name || "statement.pdf",
    );
  if (password) body.append("password", password);
  return body;
}
