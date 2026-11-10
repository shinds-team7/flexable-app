package expo.modules.budgetnotification

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BudgetNotificationModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)

  private fun update(date: String, budget: Long, spent: Long, remaining: Long, dayBudgets: List<Long>, weekAvailable: Long?): Boolean {
    val snapshot = BudgetSnapshot(date, budget, spent, remaining, System.currentTimeMillis(), dayBudgets, weekAvailable = weekAvailable)
    BudgetStore.save(context, snapshot)
    val shown = BudgetNotifier.show(context, snapshot)
    BudgetScheduler.schedule(context)
    return shown
  }

  override fun definition() = ModuleDefinition {
    Name("BudgetNotification")
    // 앱이 받은 오늘 값을 저장하고 알림을 같은 ID로 갱신한다. 값은 서버가 준 것을 그대로 넘긴다.
    AsyncFunction("update") { date: String, budget: Long, spent: Long, remaining: Long, dayBudgets: List<Long> ->
      update(date, budget, spent, remaining, dayBudgets, null)
    }
    AsyncFunction("updateExpanded") { date: String, budget: Long, spent: Long, remaining: Long, dayBudgets: List<Long>, weekAvailable: Long ->
      update(date, budget, spent, remaining, dayBudgets, weekAvailable)
    }
    AsyncFunction("clear") {
      BudgetScheduler.cancel(context)
      BudgetStore.clear(context)
      BudgetNotifier.cancel(context)
    }
  }
}
