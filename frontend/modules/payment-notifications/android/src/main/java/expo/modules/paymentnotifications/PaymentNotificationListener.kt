package expo.modules.paymentnotifications

import android.app.Notification
import android.content.ComponentName
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import java.util.concurrent.CopyOnWriteArraySet
import org.json.JSONObject

internal object PaymentEvents {
  val listeners = CopyOnWriteArraySet<() -> Unit>()
  @Volatile var connected = false
  fun changed() { listeners.forEach { it() } }
}

/** 개발자용 원문 확인에서 결제처럼 보이는 알림만 남기는 기준(메신저·광고 알림까지 쌓이지 않게) */
private val DEV_KEYWORDS = Regex("승인|결제|취소|이용|\\d\\s*원")

class PaymentNotificationListener : NotificationListenerService() {
  override fun onListenerConnected() { PaymentEvents.connected = true; PaymentEvents.changed() }
  override fun onListenerDisconnected() {
    PaymentEvents.connected = false
    requestRebind(ComponentName(this, PaymentNotificationListener::class.java))
    PaymentEvents.changed()
  }

  override fun onNotificationPosted(notification: StatusBarNotification) {
    if (notification.packageName == packageName) return
    // 개발자가 원문 확인을 직접 켠 기기에서만(파일이 있을 때만) 결제처럼 보이는 알림 원문을 기기에 남긴다.
    if (DevCaptureStore.active(this)) captureForDeveloper(notification)
    // Check the package BEFORE accessing any notification content. Never collect SMS, banks, or unsupported card apps.
    if (!PaymentSources.accepts(this, notification.packageName)) return
    val item = notification.notification
    if (item.flags and Notification.FLAG_GROUP_SUMMARY != 0 || item.flags and Notification.FLAG_ONGOING_EVENT != 0) return
    try {
      var amount: Long? = null
      val collected = PaymentStore.enqueue(this, notification.postTime) {
        val title = item.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().take(300)
        val body = (item.extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: item.extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty().take(2000)
        if (!Regex("승인|결제|이용|취소").containsMatchIn("$title\n$body")) return@enqueue null
        amount = PaymentAmount.parse(title, body)
        val identity = "${notification.key}\n${item.`when`.takeIf { it > 0 } ?: notification.postTime}\n$title\n$body"
        val id = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        JSONObject().put("id", id).put("packageName", notification.packageName).put("postedAt", notification.postTime).put("title", title).put("body", body)
      }
      if (collected) {
        PaymentEvents.changed()
        // 앱을 열기 전에도 알림창 남은 예산이 줄도록 금액과 시각만 같은 앱의 예산 알림에 넘긴다(원문은 넘기지 않는다).
        // 네이티브 금액 읽기는 신한 형식만 안다. 다른 카드 앱은 앱을 열 때 거래로 저장된 뒤 반영된다.
        if (notification.packageName == PaymentSources.SHINHAN) amount?.let { notifyBudget(it, notification.postTime) }
      }
    } catch (_: Exception) {
      // Fail closed. Never fall back to plaintext or log financial notification content.
    }
  }

  private fun captureForDeveloper(notification: StatusBarNotification) {
    try {
      val item = notification.notification
      val extras = item.extras
      DevCaptureStore.capture(this, notification.postTime) {
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().take(300)
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty().take(2000)
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty().take(2000)
        val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n").orEmpty().take(2000)
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty().take(300)
        if (!DEV_KEYWORDS.containsMatchIn(listOf(title, text, bigText, lines, subText).joinToString("\n"))) return@capture null
        JSONObject().put("key", notification.key).put("packageName", notification.packageName).put("postedAt", notification.postTime)
          .put("title", title).put("text", text).put("bigText", bigText).put("textLines", lines).put("subText", subText)
          .put("summary", item.flags and Notification.FLAG_GROUP_SUMMARY != 0)
          .put("ongoing", item.flags and Notification.FLAG_ONGOING_EVENT != 0)
      }
    } catch (_: Exception) {
      // 원문 확인 실패가 자동 기록을 막지 않게 하고, 금융 알림 내용을 로그에 남기지 않는다.
    }
  }

  private fun notifyBudget(amount: Long, postedAt: Long) {
    runCatching {
      sendBroadcast(
        Intent().setClassName(packageName, "expo.modules.budgetnotification.BudgetPaymentReceiver")
          .putExtra("amount", amount).putExtra("postedAt", postedAt),
      )
    }
  }
}
