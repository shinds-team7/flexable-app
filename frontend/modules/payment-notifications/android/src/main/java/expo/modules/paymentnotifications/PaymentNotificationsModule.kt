package expo.modules.paymentnotifications

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaymentNotificationsModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  private val change: () -> Unit = { sendEvent("onChange", emptyMap<String, Any>()) }

  private fun allowed(): Boolean {
    val component = ComponentName(context, PaymentNotificationListener::class.java)
    return if (Build.VERSION.SDK_INT >= 27) {
      context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(component)
    } else {
      Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        ?.split(":")?.contains(component.flattenToString()) == true
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PaymentNotifications")
    Events("onChange")
    OnCreate { PaymentEvents.listeners.add(change) }
    OnDestroy { PaymentEvents.listeners.remove(change) }
    AsyncFunction("status") { owner: String ->
      PaymentStore.status(context, owner) + mapOf("allowed" to allowed(), "connected" to PaymentEvents.connected)
    }
    AsyncFunction("configure") { owner: String, enabled: Boolean ->
      if (enabled) check(allowed()) { "Notification access is required" }
      PaymentStore.configure(context, owner, enabled)
      PaymentEvents.changed()
    }
    AsyncFunction("openSettings") {
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("pending") { owner: String -> PaymentStore.pending(context, owner) }
    AsyncFunction("prepare") { owner: String, id: String, body: String -> PaymentStore.prepare(context, owner, id, body) }
    AsyncFunction("acknowledge") { owner: String, id: String -> PaymentStore.acknowledge(context, owner, id) }
    AsyncFunction("clear") { PaymentStore.clear(context); PaymentEvents.changed() }
  }
}
