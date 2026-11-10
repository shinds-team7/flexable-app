package expo.modules.budgetnotification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

/** 알림창을 내리면 보이는 "오늘 남은 예산" 상시 알림. 같은 ID로 갱신해 하나만 남는다. */
object BudgetNotifier {
  const val CHANNEL = "budget-today"
  const val ID = 4101

  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

  fun amount(value: Long): String = NumberFormat.getIntegerInstance(Locale.KOREA).format(value)

  private fun open(context: Context, path: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("flexable://$path"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** 소리·진동 없는 채널. 진동 권한을 막아 두었으므로(app.json) 진동도 끈다. */
  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val channel = NotificationChannel(CHANNEL, "오늘 남은 예산", NotificationManager.IMPORTANCE_LOW).apply {
      description = "알림창에서 오늘 남은 예산을 보여 줘요"
      enableVibration(false)
      setSound(null, null)
      setShowBadge(false)
    }
    manager(context).createNotificationChannel(channel)
  }

  fun show(context: Context, s: BudgetSnapshot): Boolean {
    val manager = manager(context)
    ensureChannel(context)
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) return false
    fun views(layout: Int) = RemoteViews(context.packageName, layout).apply {
      setTextViewText(R.id.budget_amount, amount(s.remaining))
      setOnClickPendingIntent(R.id.budget_record, open(context, "transactions/new", 1))
      setOnClickPendingIntent(R.id.budget_home, open(context, "home?source=budget-notification", 2))
      if (layout == R.layout.budget_notification_expanded && s.weekAvailable != null)
        setTextViewText(R.id.budget_week_amount, "${amount(s.weekAvailable)}원")
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
    builder
      .setSmallIcon(R.drawable.ic_budget_small)
      .setColor(0xFF0046FF.toInt())
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(views(R.layout.budget_notification))
      .setContentIntent(open(context, "home?source=budget-notification", 0))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setCategory(Notification.CATEGORY_STATUS)
    if (s.weekAvailable != null) builder.setCustomBigContentView(views(R.layout.budget_notification_expanded))
    val notification = builder.build()
    manager.notify(ID, notification)
    return true
  }

  fun cancel(context: Context) = manager(context).cancel(ID)
}
