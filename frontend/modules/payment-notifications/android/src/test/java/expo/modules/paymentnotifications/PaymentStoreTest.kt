package expo.modules.paymentnotifications

import java.io.File
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35])
class PaymentStoreTest {
  private val context get() = RuntimeEnvironment.getApplication()

  @After fun clear() { PaymentStore.clear(context) }

  @Test fun `disabled collection never extracts financial notification text`() {
    PaymentStore.clear(context)
    var extracted = false
    val accepted = PaymentStore.enqueue(context, System.currentTimeMillis()) {
      extracted = true
      JSONObject().put("title", "private notification")
    }
    assertFalse(accepted)
    assertFalse(extracted)
  }

  @Test fun `unreadable encrypted state fails closed instead of collecting plaintext`() {
    context.noBackupFilesDir.mkdirs()
    File(context.noBackupFilesDir, "payment-notifications.bin").writeText("broken encrypted state")
    var extracted = false
    assertThrows(Exception::class.java) {
      PaymentStore.enqueue(context, System.currentTimeMillis()) {
        extracted = true
        JSONObject()
      }
    }
    assertFalse(extracted)
  }
}
