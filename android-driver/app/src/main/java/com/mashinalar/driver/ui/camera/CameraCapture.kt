package com.mashinalar.driver.ui.camera

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File

/**
 * Tizim kamerasini ochadi ([android.provider.MediaStore.ACTION_IMAGE_CAPTURE] orqali).
 * Ilova ichida CameraX preview yo‘q — foydalanuvchi odatdagi kamera ilovasida surat oladi.
 */
@Composable
fun CameraCapture(
  modifier: Modifier = Modifier,
  onCaptured: (File) -> Unit,
  onError: (String) -> Unit,
) {
  val context = LocalContext.current
  val app = context.applicationContext

  val captureFile = remember {
    File(app.cacheDir, "capture-${System.currentTimeMillis()}.jpg")
  }
  val authority = "${app.packageName}.fileprovider"
  val uri = remember(captureFile) {
    FileProvider.getUriForFile(app, authority, captureFile)
  }

  val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
    if (success && captureFile.exists() && captureFile.length() > 0L) {
      onCaptured(captureFile)
    } else {
      if (captureFile.exists()) captureFile.delete()
      onError("")
    }
  }

  LaunchedEffect(uri) {
    // Klaviatura / ruxsat dialogi yopilguncha biroz kutamiz — ba’zi qurilmalarda darhol launch ishlamaydi.
    delay(250)
    runCatching {
      captureFile.parentFile?.mkdirs()
      if (!captureFile.exists()) {
        captureFile.createNewFile()
      }
    }
    launcher.launch(uri)
  }

  Box(
    modifier = modifier
      .fillMaxWidth()
      .padding(vertical = 24.dp),
    contentAlignment = Alignment.Center,
  ) {
    CircularProgressIndicator()
  }
}
