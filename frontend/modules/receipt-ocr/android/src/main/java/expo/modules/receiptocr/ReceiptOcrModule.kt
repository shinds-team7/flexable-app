package expo.modules.receiptocr

import android.content.Context
import android.net.Uri
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
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        null
      }
      if (image == null) {
        recognizer.close()
        promise.reject("ERR_OCR_IMAGE", "Could not open the image", null)
      } else {
        recognizer.process(image)
          .addOnSuccessListener { text ->
            recognizer.close()
            promise.resolve(toResult(text))
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

  // Same shape the screenshot import already reads: blocks[].lines[].{text, frame{left, top, width, height}}
  private fun toResult(text: Text) = mapOf(
    "blocks" to text.textBlocks.map { block ->
      mapOf(
        "lines" to block.lines.map { line ->
          mapOf(
            "text" to line.text,
            "frame" to line.boundingBox?.let { r ->
              mapOf("left" to r.left, "top" to r.top, "width" to r.width(), "height" to r.height())
            },
          )
        },
      )
    },
  )
}
