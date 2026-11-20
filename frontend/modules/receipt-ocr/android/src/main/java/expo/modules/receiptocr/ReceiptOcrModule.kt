package expo.modules.receiptocr

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Reads text from one local image on the device (Korean + Latin). The image never leaves the device. */
class ReceiptOcrModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val recognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
      val image = try {
        decodeSampled(Uri.parse(uri))
      } catch (e: Exception) {
        null
      }
      if (image == null) {
        recognizer.close()
        promise.reject("ERR_OCR_IMAGE", "Could not open the image", null)
      } else {
        recognizer.process(image.input)
          .addOnSuccessListener { text ->
            recognizer.close()
            promise.resolve(toResult(text, image.scale))
          }
          .addOnFailureListener { e ->
            if (e is MlKitException && e.errorCode == MlKitException.UNAVAILABLE) {
              // The model is still downloading through Play services. Ask for it now and let the user retry shortly.
              ModuleInstall.getClient(context)
                .installModules(ModuleInstallRequest.newBuilder().addApi(recognizer).build())
                .addOnCompleteListener { recognizer.close() }
              promise.reject("ERR_OCR_MODEL_DOWNLOADING", "The text recognition model is being prepared", e)
            } else {
              recognizer.close()
              promise.reject("ERR_OCR", e.message ?: "Text recognition failed", e)
            }
          }
      }
    }
  }

  private class Sampled(val input: InputImage, val scale: Int)

  /**
   * Decodes the picked image at a reduced size instead of full resolution (Play vitals: bitmap downsampling).
   * Screenshots (short side up to ~1440px) stay at full size so small text is still readable;
   * camera-sized photos are halved until the short side would drop below [MIN_SHORT_SIDE].
   * Frames are scaled back by [Sampled.scale] so the parser keeps seeing original pixel coordinates.
   */
  private fun decodeSampled(uri: Uri): Sampled? {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    val shortSide = minOf(bounds.outWidth, bounds.outHeight)
    var sample = 1
    while (shortSide / (sample * 2) >= MIN_SHORT_SIDE) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample }
    val bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) } ?: return null
    val rotation = try {
      resolver.openInputStream(uri)?.use { ExifInterface(it).rotationDegrees } ?: 0
    } catch (e: Exception) {
      0
    }
    // inSampleSize may be rounded down by the decoder, so derive the real factor from the decoded width.
    val decodedLong = maxOf(bitmap.width, bitmap.height)
    val scale = maxOf(1, Math.round(maxOf(bounds.outWidth, bounds.outHeight).toFloat() / decodedLong))
    return Sampled(InputImage.fromBitmap(bitmap, rotation), scale)
  }

  // Same shape the screenshot import already reads: blocks[].lines[].{text, frame{left, top, width, height}}
  private fun toResult(text: Text, scale: Int) = mapOf(
    "blocks" to text.textBlocks.map { block ->
      mapOf(
        "lines" to block.lines.map { line ->
          mapOf(
            "text" to line.text,
            "frame" to line.boundingBox?.let { r ->
              mapOf(
                "left" to r.left * scale,
                "top" to r.top * scale,
                "width" to r.width() * scale,
                "height" to r.height() * scale,
              )
            },
          )
        },
      )
    },
  )

  private companion object {
    // Short side kept at or above this after halving: covers 1080p screenshots untouched, halves 12MP photos once.
    const val MIN_SHORT_SIDE = 1080
  }
}
