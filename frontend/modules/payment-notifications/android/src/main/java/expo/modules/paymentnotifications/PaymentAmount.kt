package expo.modules.paymentnotifications

/**
 * 알림창 "오늘 남은 예산"을 앱을 열기 전에 임시로 줄이기 위한 금액 읽기.
 * src/service/paymentNotifications/parse.ts의 금액 규칙과 같게 보수적으로 읽는다(취소·해외·누적 금액은 읽지 않는다).
 * 거래로 저장하는 판단은 앱이 하고, 여기서 읽은 값은 알림 표시용 추정이다.
 */
internal object PaymentAmount {
  private val rejected = Regex("취소|거절|실패|해외|USD|US\\$|JPY|EUR|달러|엔화|승인번호|인증번호|OTP", RegexOption.IGNORE_CASE)
  private val prefix = Regex("^-\\s+(?=승인\\s*(?:금액|일시)\\s*[:：]|(?:가맹점(?:명)?|이용처)\\s*[:：])")
  private val skipped = Regex("누적|합계|잔액|한도|예정|청구")
  private val amountLine = Regex("^(?:승인\\s*금액\\s*[:：]?\\s*)?(\\d{1,3}(?:,\\d{3})*|\\d+)\\s*원(?:\\s+(?:일시불|\\d{1,2}개월|체크))?$")

  fun parse(title: String, body: String): Long? {
    val text = "$title\n$body".replace("\r", "")
    if (rejected.containsMatchIn(text)) return null
    if (!text.contains("신한") || !text.contains("승인")) return null
    val amounts = text.split("\n")
      .map { it.trim().replace(prefix, "") }
      .filter { it.isNotEmpty() && !skipped.containsMatchIn(it) }
      .mapNotNull { amountLine.find(it)?.groupValues?.get(1)?.replace(",", "")?.toLongOrNull() }
    val amount = amounts.singleOrNull() ?: return null
    return amount.takeIf { it in 1..999_999_999_999 }
  }
}
