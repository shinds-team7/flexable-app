package expo.modules.paymentnotifications

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

/** No tokens or network requests. The queue is encrypted with a non-exportable Android Keystore key. */
internal object PaymentStore {
  private const val ALIAS = "flexable-payment-notifications-v1"
  private const val RETENTION = 7L * 24 * 60 * 60 * 1000
  private const val LIMIT = 200

  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "payment-notifications.bin"))

  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }

  private fun read(context: Context): JSONObject {
    val source = file(context)
    if (!source.baseFile.exists()) return JSONObject()
    val envelope = JSONObject(String(source.readFully(), Charsets.UTF_8))
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)))
    return JSONObject(String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
  }

  private fun write(context: Context, state: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val envelope = JSONObject()
      .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("data", Base64.encodeToString(cipher.doFinal(state.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
    val target = file(context)
    val stream = target.startWrite()
    try {
      stream.write(envelope.toString().toByteArray(Charsets.UTF_8))
      target.finishWrite(stream)
    } catch (error: Exception) {
      target.failWrite(stream)
      throw error
    }
  }

  private fun prune(state: JSONObject): JSONObject {
    val since = System.currentTimeMillis() - RETENTION
    val queue = state.optJSONArray("queue") ?: JSONArray()
    val kept = JSONArray()
    var expired = 0
    for (i in 0 until queue.length()) {
      val row = queue.getJSONObject(i)
      if (row.getLong("postedAt") >= since) kept.put(row) else expired++
    }
    val done = state.optJSONObject("done") ?: JSONObject()
    done.keys().asSequence().toList().forEach { if (done.optLong(it) < since) done.remove(it) }
    return state.put("queue", kept).put("done", done)
      .put("dropped", state.optInt("dropped") + expired)
  }

  @Synchronized fun status(context: Context, owner: String): Map<String, Any> {
    val state = prune(read(context))
    if (state.optString("owner") != owner) return mapOf("enabled" to false, "pending" to 0, "dropped" to 0)
    write(context, state)
    return mapOf("enabled" to state.optBoolean("enabled"), "pending" to state.getJSONArray("queue").length(), "dropped" to state.optInt("dropped"))
  }

  @Synchronized fun configure(context: Context, owner: String, enabled: Boolean) {
    val old = read(context)
    val state = if (old.optString("owner") == owner) prune(old) else JSONObject().put("owner", owner)
    // Revoking consent removes raw pending notifications. Keep only hashes to prevent re-import on reconnect.
    if (!enabled) state.put("queue", JSONArray())
    if (enabled && !state.optBoolean("enabled")) state.put("enabledAt", System.currentTimeMillis())
    write(context, state.put("enabled", enabled))
  }

  @Synchronized fun clear(context: Context) { file(context).delete() }

  @Synchronized fun enqueue(context: Context, row: JSONObject): Boolean {
    val state = prune(read(context))
    if (!state.optBoolean("enabled") || row.getLong("postedAt") < state.optLong("enabledAt")) return false
    val queue = state.getJSONArray("queue")
    val id = row.getString("id")
    if (state.getJSONObject("done").has(id) || (0 until queue.length()).any { queue.getJSONObject(it).getString("id") == id }) return false
    if (queue.length() >= LIMIT) {
      write(context, state.put("dropped", state.optInt("dropped") + 1))
      return false
    }
    queue.put(row)
    write(context, state)
    return true
  }

  @Synchronized fun pending(context: Context, owner: String): List<Map<String, Any>> {
    val state = prune(read(context))
    if (state.optString("owner") != owner || !state.optBoolean("enabled")) return emptyList()
    write(context, state)
    val queue = state.getJSONArray("queue")
    return (0 until queue.length()).map {
      val row = queue.getJSONObject(it)
      mapOf("id" to row.getString("id"), "title" to row.getString("title"), "body" to row.getString("body"), "postedAt" to row.getLong("postedAt"), "prepared" to row.optString("prepared"))
    }
  }

  @Synchronized fun prepare(context: Context, owner: String, id: String, body: String): String {
    val state = prune(read(context))
    check(state.optString("owner") == owner && state.optBoolean("enabled")) { "Collection is disabled" }
    val queue = state.getJSONArray("queue")
    val row = (0 until queue.length()).map { queue.getJSONObject(it) }.firstOrNull { it.getString("id") == id }
      ?: error("Notification is no longer pending")
    if (row.optString("prepared").isEmpty()) row.put("prepared", body)
    write(context, state)
    return row.getString("prepared")
  }

  @Synchronized fun acknowledge(context: Context, owner: String, id: String) {
    val state = prune(read(context))
    if (state.optString("owner") != owner) return
    val queue = state.getJSONArray("queue")
    val kept = JSONArray()
    for (i in 0 until queue.length()) if (queue.getJSONObject(i).getString("id") != id) kept.put(queue.getJSONObject(i))
    state.getJSONObject("done").put(id, System.currentTimeMillis())
    write(context, state.put("queue", kept))
  }
}
