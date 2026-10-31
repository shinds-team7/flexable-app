package expo.modules.paymentnotifications

import android.app.Notification
import android.content.ComponentName
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

class PaymentNotificationListener : NotificationListenerService() {
  override fun onListenerConnected() { PaymentEvents.connected = true; PaymentEvents.changed() }
  override fun onListenerDisconnected() {
    PaymentEvents.connected = false
    requestRebind(ComponentName(this, PaymentNotificationListener::class.java))
    PaymentEvents.changed()
  }

  override fun onNotificationPosted(notification: StatusBarNotification) {
    // Check the package BEFORE accessing any notification content. Never collect SMS, other banks, or our own notifications.
    if (notification.packageName != "com.shcard.smartpay") return
    val item = notification.notification
    if (item.flags and Notification.FLAG_GROUP_SUMMARY != 0 || item.flags and Notification.FLAG_ONGOING_EVENT != 0) return
    try {
      val collected = PaymentStore.enqueue(this, notification.postTime) {
        val title = item.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().take(300)
        val body = (item.extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: item.extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty().take(2000)
        if (!Regex("승인|결제|이용|취소").containsMatchIn("$title\n$body")) return@enqueue null
        val identity = "${notification.key}\n${item.`when`.takeIf { it > 0 } ?: notification.postTime}\n$title\n$body"
        val id = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        JSONObject().put("id", id).put("postedAt", notification.postTime).put("title", title).put("body", body)
      }
      if (collected) PaymentEvents.changed()
    } catch (_: Exception) {
      // Fail closed. Never fall back to plaintext or log financial notification content.
    }
  }
}
