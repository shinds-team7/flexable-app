package expo.modules.paymentnotifications

import android.content.Context
import android.util.AtomicFile
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * 개발자용 알림 원문 확인. 다른 카드사 파서를 만들려고 개발자 기기에서 직접 켰을 때만, 결제처럼 보이는 알림의
 * 제목·본문·펼친 본문·여러 줄 본문을 손대지 않고 기기에만 암호화해 둔다(최대 30개, 24시간). 서버로 보내지 않는다.
 * 꺼져 있으면 파일이 없고, 알림 내용을 읽지 않는다.
 */
internal object DevCaptureStore {
  private const val RETENTION = 24L * 60 * 60 * 1000
  private const val LIMIT = 30

  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "payment-dev-captures.bin"))

  /** 꺼져 있을 때 모든 알림마다 복호화하지 않도록 파일 존재만 본다(끄면 파일을 지운다) */
  fun active(context: Context): Boolean = file(context).baseFile.exists()

  private fun read(context: Context): JSONObject {
    val state = PaymentStore.readEncrypted(file(context))
    val since = System.currentTimeMillis() - RETENTION
    val items = state.optJSONArray("items") ?: JSONArray()
    val kept = JSONArray()
    for (i in 0 until items.length()) if (items.getJSONObject(i).optLong("postedAt") >= since) kept.put(items.getJSONObject(i))
    return state.put("items", kept)
  }

  @Synchronized fun status(context: Context): Map<String, Any> {
    if (!active(context)) return mapOf("enabled" to false, "count" to 0)
    return mapOf("enabled" to true, "count" to read(context).getJSONArray("items").length())
  }

  @Synchronized fun configure(context: Context, enabled: Boolean) {
    if (!enabled) { clear(context); return }
    if (active(context)) return
    PaymentStore.writeEncrypted(file(context), JSONObject().put("enabledAt", System.currentTimeMillis()).put("items", JSONArray()))
  }

  @Synchronized fun clear(context: Context) { file(context).delete() }

  @Synchronized fun capture(context: Context, postedAt: Long, content: () -> JSONObject?): Boolean {
    if (!active(context)) return false
    val state = read(context)
    if (postedAt < state.optLong("enabledAt")) return false
    val row = content() ?: return false
    val items = state.getJSONArray("items")
    val key = row.optString("key")
    if ((0 until items.length()).any { items.getJSONObject(it).optString("key") == key && items.getJSONObject(it).optLong("postedAt") == postedAt }) return false
    val kept = JSONArray()
    val start = if (items.length() >= LIMIT) items.length() - LIMIT + 1 else 0
    for (i in start until items.length()) kept.put(items.getJSONObject(i))
    kept.put(row)
    PaymentStore.writeEncrypted(file(context), state.put("items", kept))
    return true
  }

  @Synchronized fun list(context: Context): List<Map<String, Any>> {
    if (!active(context)) return emptyList()
    val items = read(context).getJSONArray("items")
    return (items.length() - 1 downTo 0).map { i ->
      val row = items.getJSONObject(i)
      mapOf(
        "packageName" to row.optString("packageName"),
        "postedAt" to row.optLong("postedAt"),
        "title" to row.optString("title"),
        "text" to row.optString("text"),
        "bigText" to row.optString("bigText"),
        "textLines" to row.optString("textLines"),
        "subText" to row.optString("subText"),
        "summary" to row.optBoolean("summary"),
        "ongoing" to row.optBoolean("ongoing"),
      )
    }
  }
}
