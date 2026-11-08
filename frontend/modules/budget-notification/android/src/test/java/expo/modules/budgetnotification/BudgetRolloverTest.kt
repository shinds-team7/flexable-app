package expo.modules.budgetnotification

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BudgetRolloverTest {
  private fun seoul(y: Int, m: Int, d: Int, h: Int = 12, min: Int = 0) =
    Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul")).apply { clear(); set(y, m - 1, d, h, min) }.timeInMillis

  private val week = listOf(10_000L, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000)
  private fun saved(date: String) = BudgetSnapshot(date, 40_000, 5_000, 35_000, 0, week)

  @Test fun sameDayKeepsServerValue() {
    val now = seoul(2026, 11, 9)
    assertEquals(saved("2026-11-09"), BudgetRollover.forToday(saved("2026-11-09"), now))
  }

  @Test fun nextDayPicksWeekdayBudgetWithoutSpending() {
    // 2026-11-10은 화요일 → 두 번째 값
    val r = BudgetRollover.forToday(saved("2026-11-09"), seoul(2026, 11, 10, 0, 1))!!
    assertEquals("2026-11-10", r.date)
    assertEquals(20_000, r.budget)
    assertEquals(0, r.spent)
    assertEquals(20_000, r.remaining)
    assertTrue(r.stale)
  }

  @Test fun sundayIsLastIndex() {
    assertEquals(6, BudgetClock.weekdayIndex(seoul(2026, 11, 8)))
    assertEquals(0, BudgetClock.weekdayIndex(seoul(2026, 11, 9)))
  }

  @Test fun noWeekBudgetsMeansNothingToShow() {
    assertNull(BudgetRollover.forToday(saved("2026-11-09").copy(dayBudgets = emptyList()), seoul(2026, 11, 10)))
  }

  @Test fun midnightDelayLandsJustAfterMidnight() {
    val now = seoul(2026, 11, 9, 23, 0)
    assertEquals(60 * 60 * 1000L + 5_000, BudgetClock.untilNextMidnight(now))
  }

  @Test fun paymentLowersRemainingToday() {
    val now = seoul(2026, 11, 9)
    val r = BudgetRollover.withPayment(saved("2026-11-09"), 12_000, now - 60_000, now)!!
    assertEquals(17_000, r.spent)
    assertEquals(23_000, r.remaining)
    assertTrue(r.stale)
  }

  @Test fun paymentAfterRolloverStartsFromWeekdayBudget() {
    val now = seoul(2026, 11, 10, 0, 30)
    val r = BudgetRollover.withPayment(saved("2026-11-09"), 5_000, now - 60_000, now)!!
    assertEquals(5_000, r.spent)
    assertEquals(15_000, r.remaining)
  }

  @Test fun paymentFromAnotherDayIsIgnored() {
    val now = seoul(2026, 11, 10, 0, 30)
    assertNull(BudgetRollover.withPayment(saved("2026-11-10"), 5_000, seoul(2026, 11, 9, 23, 50), now))
  }
}
