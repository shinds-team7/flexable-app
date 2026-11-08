package expo.modules.budgetnotification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 결제 알림 수집기가 알려 준 금액을 오늘 지출에 임시로 더해 알림을 갱신한다. 상시 알림이 꺼져 있으면(저장값 없음) 아무것도 하지 않는다. */
class BudgetPaymentReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val amount = intent.getLongExtra("amount", 0)
    val postedAt = intent.getLongExtra("postedAt", 0)
    if (amount <= 0 || postedAt <= 0) return
    val saved = BudgetStore.load(context) ?: return
    val next = BudgetRollover.withPayment(saved, amount, postedAt, System.currentTimeMillis()) ?: return
    BudgetStore.save(context, next)
    BudgetNotifier.show(context, next)
  }
}
