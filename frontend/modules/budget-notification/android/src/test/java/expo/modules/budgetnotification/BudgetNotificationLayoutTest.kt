package expo.modules.budgetnotification

import android.app.NotificationManager
import android.content.Context
import android.widget.FrameLayout
import android.widget.TextView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Exercise the same RemoteViews inflation that System UI uses, beyond XML compilation. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28, 33, 35])
class BudgetNotificationLayoutTest {
  @Test fun notificationLayoutsRenderServerAmounts() {
    val context = RuntimeEnvironment.getApplication()
    val snapshot = BudgetSnapshot("2026-11-11", 40_000, 5_000, 35_000, 0,
      listOf(40_000, 40_000, 40_000, 40_000, 40_000, 40_000, 40_000), weekAvailable = 95_000)

    assertTrue(BudgetNotifier.show(context, snapshot))
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val notification = manager.activeNotifications.single { it.id == BudgetNotifier.ID }.notification
    val collapsed = notification.contentView.apply(context, FrameLayout(context))
    assertEquals("35,000", collapsed.findViewById<TextView>(R.id.budget_amount).text.toString())
    val expanded = notification.bigContentView.apply(context, FrameLayout(context))
    assertEquals("35,000", expanded.findViewById<TextView>(R.id.budget_amount).text.toString())
    assertEquals("95,000원", expanded.findViewById<TextView>(R.id.budget_week_amount).text.toString())
  }
}
