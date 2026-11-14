import type { PaymentNotice } from "./native";
import { parseShinhanNotice, type PaymentParse } from "./parse";

export const SHINHAN_PACKAGE = "com.shcard.smartpay";

/**
 * 자동 기록하는 카드 앱과 그 파서. 실제 앱 푸시 원문(개발자용 원문 확인으로 모은 것)으로 테스트를 만든 카드사만
 * 하나씩 더한다. 여기에 더하면 네이티브 리스너도 그 앱 알림을 모으기 시작한다(setSources).
 * 신한 SOL페이 외 카드사를 더할 때는 개인정보처리방침·동의 문구를 같은 PR에서 고친다.
 */
const PARSERS: Record<string, (notice: PaymentNotice) => PaymentParse> = {
  [SHINHAN_PACKAGE]: parseShinhanNotice,
};

export function parsePaymentNotice(notice: PaymentNotice): PaymentParse {
  const parse = PARSERS[notice.packageName || SHINHAN_PACKAGE];
  return parse ? parse(notice) : { reason: "지원하지 않는 카드 앱 알림이에요" };
}

export function extraPaymentSources(): string[] {
  return Object.keys(PARSERS).filter((name) => name !== SHINHAN_PACKAGE);
}
