package expo.modules.budgetnotification

import java.util.Calendar
import java.util.TimeZone

/** 서버가 계산해 준 오늘 예산 값. 앱 화면과 같은 값을 알림이 그대로 쓴다. */
data class BudgetSnapshot(
  val date: String,
  val budget: Long,
  val spent: Long,
  val remaining: Long,
  val updatedAt: Long,
  /** 월~일 요일별 하루 예산(서버 값). 앱을 열지 못한 채 날짜가 바뀔 때만 쓴다 */
  val dayBudgets: List<Long>,
  /** true면 날짜가 바뀐 뒤 앱에서 아직 서버 값을 받지 못한 추정값 */
  val stale: Boolean = false,
)

object BudgetClock {
  private val seoul: TimeZone = TimeZone.getTimeZone("Asia/Seoul")

  private fun calendar(now: Long) = Calendar.getInstance(seoul).apply { timeInMillis = now }

  fun today(now: Long): String {
    val c = calendar(now)
    return "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  /** 월요일 0 … 일요일 6 */
  fun weekdayIndex(now: Long) = (calendar(now).get(Calendar.DAY_OF_WEEK) + 5) % 7

  /** 다음 자정(서울)까지 남은 밀리초. 절전 지연을 줄이려고 자정 5초 뒤로 맞춘다. */
  fun untilNextMidnight(now: Long): Long {
    val c = calendar(now).apply {
      add(Calendar.DAY_OF_MONTH, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 5)
      set(Calendar.MILLISECOND, 0)
    }
    return c.timeInMillis - now
  }
}

object BudgetRollover {
  /**
   * 저장한 값이 오늘 것이면 그대로, 날짜가 바뀌었으면 서버가 준 요일별 예산에서 오늘 요일 값을 골라
   * 지출 0으로 보여 준다(계산 없이 고르기만 한다). 앱을 열면 서버 값으로 바로잡힌다.
   * 요일별 예산이 없으면 null(보여 줄 수 없음).
   */
  fun forToday(saved: BudgetSnapshot, now: Long): BudgetSnapshot? {
    val today = BudgetClock.today(now)
    if (saved.date == today) return saved
    if (saved.date > today) return null
    val budget = saved.dayBudgets.getOrNull(BudgetClock.weekdayIndex(now)) ?: return null
    return saved.copy(date = today, budget = budget, spent = 0, remaining = budget, updatedAt = now, stale = true)
  }
}
