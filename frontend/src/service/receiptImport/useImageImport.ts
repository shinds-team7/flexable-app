import { router } from "expo-router";
import { useState } from "react";
import { seoulDate } from "../ui";
import { imageImportSupported, pickAndRecognize } from "./ocr";
import { parseReceipt } from "./parse";
import { setPending } from "./store";
export { imageImportSupported };
/** 스크린샷 1장을 골라 거래 후보를 읽고 검토 화면으로 보낸다. 실패하면 사용자에게 보여 줄 문장을 error에 둔다. */
export function useImageImport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const lines = await pickAndRecognize();
      if (!lines) return;
      const { items } = parseReceipt(lines, seoulDate());
      if (items.length === 0) {
        setError(
          "거래내역을 읽지 못했어요. 토스·카카오뱅크·카카오페이의 거래내역 화면을 캡처해 올려 주세요",
        );
        return;
      }
      setPending(items);
      router.push("/transactions/import");
    } catch {
      setError("이 기기에서는 이미지를 읽지 못했어요. 직접 입력해 주세요");
    } finally {
      setBusy(false);
    }
  };
  return { start, busy, error, clearError: () => setError(undefined) };
}
