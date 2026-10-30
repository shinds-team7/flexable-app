import { receiptDiagnostics, type OcrLine } from "./parse";

export type RecognitionStats = {
  blocks: number;
  rawLines: number;
  framedLines: number;
  validLines: number;
  frameKeys: string[];
};

type UpdateInfo = {
  runtimeVersion: string | null;
  updateId: string | null;
  channel: string | null;
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
};

// 날짜·통화 단위와 화면 고정 문구만 남긴다. 숫자는 전부 0, 그 외 글자는 x로 바꾼다.
const STRUCTURE =
  /카카오\s*페이\s*머니|페이\s*머니|카드\s*만들기|입출금통장|채우기|보내기|가져오기|잔액|체크카드|결제\s*취소|환불|송금\s*받기|송금|결제|충전|출금|입금|My\s*구독|[월화수목금토일]\s*요\s*일|\d+\s*[월일]|[\d,]+\s*원/gi;
const hide = (text: string) =>
  text.replace(/[0-9]/g, "0").replace(/[^\s0.,+\-−–:|｜│丨·・•ㆍ→←()/]/g, "x");

export function maskOcrText(text: string) {
  let at = 0;
  let masked = "";
  for (const match of text.matchAll(STRUCTURE)) {
    masked += hide(text.slice(at, match.index));
    masked += match[0].replace(/[0-9]/g, "0");
    at = match.index + match[0].length;
  }
  return (masked + hide(text.slice(at))).slice(0, 200);
}

export function createImportDiagnostic(
  lines: OcrLine[],
  recognition: RecognitionStats | null,
  updates: UpdateInfo,
  stage: "no-transactions" | "recognition-error",
) {
  const counts = receiptDiagnostics(lines);
  const revision = updates.updateId?.slice(0, 8) ?? "embedded";
  return {
    summary: `확인 코드 OCR-2 / ${updates.runtimeVersion ?? "unknown"} / ${revision} / 글자 ${counts.lines}줄 / 금액 ${counts.amounts} / 날짜 ${counts.dates + counts.payDays}`,
    detail: JSON.stringify({
      format: "receipt-ocr-2",
      stage,
      updates: {
        runtimeVersion: updates.runtimeVersion,
        updateId: updates.updateId,
        channel: updates.channel,
        isEnabled: updates.isEnabled,
        isEmbeddedLaunch: updates.isEmbeddedLaunch,
      },
      recognition,
      counts,
      // 메모리에만 두며 사용자가 공유 버튼을 누를 때만 시스템 공유 화면에 전달한다.
      shapes: lines.slice(0, 100).map((l) => ({
        x: Number.isFinite(l.x) ? Math.round(l.x) : null,
        y: Number.isFinite(l.y) ? Math.round(l.y) : null,
        text: maskOcrText(l.text),
      })),
    }),
  };
}
