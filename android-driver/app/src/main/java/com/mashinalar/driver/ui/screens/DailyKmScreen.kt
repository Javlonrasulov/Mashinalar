package com.mashinalar.driver.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.view.inputmethod.InputMethodManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.ui.components.PhotoAttachmentRow
import com.mashinalar.driver.R
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Kamera: [FuelScreen] bilan bir xil — TakePicture launcher bu composable darajasida.
 * Layout: [FuelScreen] kabi [Box] — [Column]+[weight] ba’zan NavHost cheksiz balandlikda kamerani sindiradi.
 * [view.post]: klaviatura yopilgach keyingi frame’da intent (Samsung / API 36).
 */
@Composable
fun DailyKmScreen(
  snackbarHost: SnackbarHostState,
  modifier: Modifier = Modifier,
  vm: DailyKmViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  var captureTarget by remember { mutableStateOf<String?>(null) }

  val context = LocalContext.current
  val app = context.applicationContext
  val focusManager = LocalFocusManager.current
  val keyboard = LocalSoftwareKeyboardController.current
  val view = LocalView.current
  val scope = rememberCoroutineScope()
  val cameraFailed = stringResource(R.string.camera_open_failed)
  val cameraPermMsg = stringResource(R.string.camera_permission)

  var pendingCaptureFile by remember { mutableStateOf<File?>(null) }
  var pendingUri by remember { mutableStateOf<Uri?>(null) }
  var pendingSlot by remember { mutableStateOf<String?>(null) }

  fun clearCaptureFlow() {
    pendingCaptureFile = null
    pendingUri = null
    pendingSlot = null
    captureTarget = null
  }

  val takePictureLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
      val f = pendingCaptureFile
      val slot = pendingSlot
      clearCaptureFlow()
      if (success && f != null && f.exists() && f.length() > 0L) {
        when (slot) {
          "start" -> vm.setStartPhoto(f)
          "end" -> vm.setEndPhoto(f)
        }
      } else {
        runCatching { f?.delete() }
        scope.launch { snackbarHost.showSnackbar(cameraFailed) }
      }
    }

  val permissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (granted) {
        val uri = pendingUri
        if (uri != null) {
          view.post {
            try {
              takePictureLauncher.launch(uri)
            } catch (_: android.content.ActivityNotFoundException) {
              runCatching { pendingCaptureFile?.delete() }
              clearCaptureFlow()
              scope.launch { snackbarHost.showSnackbar(cameraFailed) }
            }
          }
        }
      } else {
        runCatching { pendingCaptureFile?.delete() }
        clearCaptureFlow()
        scope.launch { snackbarHost.showSnackbar(cameraPermMsg) }
      }
    }

  suspend fun prepareThenOpenCapture(target: String) {
    if (target == "end" && !vm.state.value.endSectionVisible) return

    keyboard?.hide()
    @Suppress("DEPRECATION")
    val imm = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.hideSoftInputFromWindow(view.windowToken, 0)
    focusManager.clearFocus(true)
    delay(280)

    val file = File(app.cacheDir, "dailykm-${System.currentTimeMillis()}.jpg")
    runCatching {
      file.parentFile?.mkdirs()
      if (!file.exists()) file.createNewFile()
    }
    val authority = "${app.packageName}.fileprovider"
    val uri = FileProvider.getUriForFile(app, authority, file)

    pendingCaptureFile = file
    pendingUri = uri
    pendingSlot = target
    captureTarget = target

    val hasPerm =
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    if (hasPerm) {
      view.post {
        try {
          takePictureLauncher.launch(uri)
        } catch (_: android.content.ActivityNotFoundException) {
          runCatching { file.delete() }
          clearCaptureFlow()
          scope.launch { snackbarHost.showSnackbar(cameraFailed) }
        }
      }
    } else {
      view.post {
        permissionLauncher.launch(Manifest.permission.CAMERA)
      }
    }
  }

  LaunchedEffect(state.message) {
    val msg = state.message ?: return@LaunchedEffect
    snackbarHost.showSnackbar(msg)
  }

  LaunchedEffect(state.endSectionVisible) {
    if (state.endSectionVisible) {
      clearCaptureFlow()
    }
  }

  val startReady = state.startKm.trim().isNotEmpty() && state.startPhoto != null
  val endReady = state.endKm.trim().isNotEmpty() && state.endPhoto != null

  Box(
    modifier = modifier
      .fillMaxSize()
      .padding(16.dp)
      .imePadding(),
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState()),
    ) {
      if (!state.endSectionVisible) {
        OutlinedTextField(
          modifier = Modifier.fillMaxWidth(),
          value = state.startKm,
          onValueChange = vm::setStartKm,
          label = { Text(stringResource(R.string.start_km_field)) },
          singleLine = true,
        )

        Spacer(Modifier.height(12.dp))
        if (state.startPhoto == null && captureTarget != "start") {
          Button(modifier = Modifier.fillMaxWidth(), onClick = { scope.launch { prepareThenOpenCapture("start") } }) {
            Text(stringResource(R.string.start_odometer_photo))
          }
        } else if (state.startPhoto == null && captureTarget == "start") {
          Spacer(Modifier.height(8.dp))
          Text(
            stringResource(R.string.camera_opening),
            style = MaterialTheme.typography.bodyMedium,
          )
        } else if (captureTarget != "start") {
          Spacer(Modifier.height(8.dp))
          PhotoAttachmentRow(
            title = stringResource(R.string.start_odometer_photo),
            file = state.startPhoto!!,
            onRetake = { scope.launch { prepareThenOpenCapture("start") } },
            onRemove = { vm.clearStartPhoto() },
          )
        }
      } else {
        OutlinedTextField(
          modifier = Modifier.fillMaxWidth(),
          value = state.endKm,
          onValueChange = vm::setEndKm,
          label = { Text(stringResource(R.string.end_km_field)) },
          singleLine = true,
        )

        Spacer(Modifier.height(12.dp))
        if (state.endPhoto == null && captureTarget != "end") {
          Button(modifier = Modifier.fillMaxWidth(), onClick = { scope.launch { prepareThenOpenCapture("end") } }) {
            Text(stringResource(R.string.end_odometer_photo))
          }
        } else if (state.endPhoto == null && captureTarget == "end") {
          Spacer(Modifier.height(8.dp))
          Text(
            stringResource(R.string.camera_opening),
            style = MaterialTheme.typography.bodyMedium,
          )
        } else if (captureTarget != "end") {
          Spacer(Modifier.height(8.dp))
          PhotoAttachmentRow(
            title = stringResource(R.string.end_odometer_photo),
            file = state.endPhoto!!,
            onRetake = { scope.launch { prepareThenOpenCapture("end") } },
            onRemove = { vm.clearEndPhoto() },
          )
        }
      }

      // Pastdagi qotirilgan YUBORISH ustidan scroll bo‘lishi uchun (Fuel: 72.dp, KM — ikki bosqich + klaviatura)
      Spacer(Modifier.height(120.dp))
    }

    Button(
      modifier = Modifier
        .fillMaxWidth()
        .align(Alignment.BottomCenter)
        .padding(bottom = 12.dp),
      enabled = if (!state.endSectionVisible) {
        startReady && !state.loading
      } else {
        endReady && !state.loading
      },
      onClick = {
        if (!state.endSectionVisible) vm.submitStart() else vm.submitEnd()
      },
    ) {
      if (state.loading) {
        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.height(18.dp))
      }
      Text(
        if (state.loading) {
          stringResource(R.string.sending)
        } else {
          stringResource(R.string.send)
        },
      )
    }
  }
}
