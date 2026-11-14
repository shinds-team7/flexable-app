package expo.modules.paymentnotifications

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35])
class DevCaptureAndSourcesTest {
  private val context get() = RuntimeEnvironment.getApplication()

  @After fun clear() {
    DevCaptureStore.clear(context)
    PaymentSources.set(context, emptyList())
  }

  @Test fun `developer capture is off by default and never reads notification text`() {
    DevCaptureStore.clear(context)
    var extracted = false
    val captured = DevCaptureStore.capture(context, System.currentTimeMillis()) {
      extracted = true
      JSONObject().put("title", "private notification")
    }
    assertFalse(DevCaptureStore.active(context))
    assertFalse(captured)
    assertFalse(extracted)
    assertEquals(mapOf("enabled" to false, "count" to 0), DevCaptureStore.status(context))
    assertTrue(DevCaptureStore.list(context).isEmpty())
  }

  @Test fun `only Shinhan SOL Pay is accepted until the app adds a verified card source`() {
    assertTrue(PaymentSources.accepts(context, "com.shcard.smartpay"))
    assertFalse(PaymentSources.accepts(context, "com.example.card"))
    PaymentSources.set(context, listOf("com.example.card", "not a package", context.packageName, "com.shcard.smartpay"))
    assertTrue(PaymentSources.accepts(context, "com.example.card"))
    assertFalse(PaymentSources.accepts(context, "not a package"))
    assertFalse(PaymentSources.accepts(context, context.packageName))
    assertEquals(setOf("com.example.card"), PaymentSources.extra(context))
    PaymentSources.set(context, emptyList())
    assertFalse(PaymentSources.accepts(context, "com.example.card"))
    assertTrue(PaymentSources.accepts(context, "com.shcard.smartpay"))
  }
}
