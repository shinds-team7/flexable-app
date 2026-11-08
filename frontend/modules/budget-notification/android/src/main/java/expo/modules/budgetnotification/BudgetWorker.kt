package expo.modules.budgetnotification

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * 앱을 열지 않아도 날짜가 바뀌면 알림을 오늘 값으로 바꾼다.
 * 절전 때문에 정시 실행은 보장되지 않으므로 자정 직후 한 번 + 15분마다 보완한다.
 */
class BudgetWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val saved = BudgetStore.load(applicationContext) ?: return Result.success()
    val now = System.currentTimeMillis()
    val today = BudgetRollover.forToday(saved, now)
    if (today != null) {
      if (today != saved) BudgetStore.save(applicationContext, today)
      BudgetNotifier.show(applicationContext, today)
    }
    BudgetScheduler.scheduleMidnight(applicationContext)
    return Result.success()
  }
}

object BudgetScheduler {
  private const val PERIODIC = "budget-notification-periodic"
  private const val MIDNIGHT = "budget-notification-midnight"

  fun schedule(context: Context) {
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<BudgetWorker>(15, TimeUnit.MINUTES).build(),
    )
    scheduleMidnight(context)
  }

  fun scheduleMidnight(context: Context) {
    WorkManager.getInstance(context).enqueueUniqueWork(
      MIDNIGHT, ExistingWorkPolicy.REPLACE,
      OneTimeWorkRequestBuilder<BudgetWorker>()
        .setInitialDelay(BudgetClock.untilNextMidnight(System.currentTimeMillis()), TimeUnit.MILLISECONDS)
        .build(),
    )
  }

  fun cancel(context: Context) {
    val work = WorkManager.getInstance(context)
    work.cancelUniqueWork(PERIODIC)
    work.cancelUniqueWork(MIDNIGHT)
  }
}
