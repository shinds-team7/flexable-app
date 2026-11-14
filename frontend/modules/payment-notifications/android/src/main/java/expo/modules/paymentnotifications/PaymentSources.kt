package expo.modules.paymentnotifications

import android.content.Context

/**
 * 자동 기록 대상 알림 앱. 신한 SOL페이는 항상 포함하고, 그 밖의 카드 앱은 앱(JS)이 실제 원문으로 검증한 파서를
 * 갖춘 뒤에만 setSources로 더한다. 그래서 카드사를 하나씩 더할 때 새 네이티브 빌드 없이 원격 업데이트로 켤 수 있다.
 * 패키지 이름만 저장하므로 암호화하지 않는다.
 */
internal object PaymentSources {
  const val SHINHAN = "com.shcard.smartpay"
  private const val PREFS = "flexable-payment-sources"
  private const val KEY = "packages"
  private val packageName = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")

  fun accepts(context: Context, pkg: String): Boolean =
    pkg == SHINHAN || pkg in extra(context)

  fun extra(context: Context): Set<String> =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY, emptySet()).orEmpty()

  fun set(context: Context, packages: List<String>) {
    val valid = packages.filter { it != context.packageName && packageName.matches(it) && it.length <= 200 }.toSet() - SHINHAN
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY, valid).apply()
  }
}
