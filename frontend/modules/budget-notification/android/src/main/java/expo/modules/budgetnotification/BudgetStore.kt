package expo.modules.budgetnotification

import android.content.Context
import org.json.JSONArray

object BudgetStore {
  private const val FILE = "budget_notification"

  private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun save(context: Context, s: BudgetSnapshot) {
    val edit = prefs(context).edit()
      .putString("date", s.date).putLong("budget", s.budget).putLong("spent", s.spent)
      .putLong("remaining", s.remaining).putLong("updatedAt", s.updatedAt)
      .putString("dayBudgets", JSONArray(s.dayBudgets).toString()).putBoolean("stale", s.stale)
    if (s.weekAvailable == null) edit.remove("weekAvailable") else edit.putLong("weekAvailable", s.weekAvailable)
    edit.apply()
  }

  fun load(context: Context): BudgetSnapshot? {
    val p = prefs(context)
    val date = p.getString("date", null) ?: return null
    val days = runCatching {
      JSONArray(p.getString("dayBudgets", "[]")).let { a -> List(a.length()) { a.getLong(it) } }
    }.getOrDefault(emptyList())
    return BudgetSnapshot(
      date, p.getLong("budget", 0), p.getLong("spent", 0), p.getLong("remaining", 0),
      p.getLong("updatedAt", 0), days, p.getBoolean("stale", false),
      if (p.contains("weekAvailable")) p.getLong("weekAvailable", 0) else null,
    )
  }

  fun clear(context: Context) = prefs(context).edit().clear().apply()
}
