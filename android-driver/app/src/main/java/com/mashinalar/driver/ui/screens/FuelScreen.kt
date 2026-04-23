package com.mashinalar.driver.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.view.inputmethod.InputMethodManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.R
import com.mashinalar.driver.ui.components.PhotoAttachmentRow
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun FuelScreen(
  snackbarHost: SnackbarHostState,
  modifier: Modifier = Modifier,
  vm: FuelViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  /** UI: kamera jarayoni boshlangan (tugma o‘rnida matn) */
  var captureTarget by remember { mutableStateOf<String?>(null) }
  val amountHasDigits = state.amount.any { it.isDigit() }
  val canSubmit =
    amountHasDigits && state.vehiclePhoto != null && state.receiptPhoto != null && !state.loading

  val context = LocalContext.current
  val app = context.applicationContext
  val focusManager = LocalFocusManager.current
  val keyboard = LocalSoftwareKeyboardController.current
  val view = LocalView.current
  val scope = rememberCoroutineScope()
  val cameraFailed = stringResource(R.string.camera_open_failed)
  val cameraPermMsg = stringResource(R.string.camera_permission)

  /** TakePicture callback uchun — launcher har doim [FuelScreen] darajasida ro‘yxatdan o‘tadi (Samsung/Android 14). */
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
          "vehicle" -> vm.setVehiclePhoto(f)
          "receipt" -> vm.setReceiptPhoto(f)
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
          try {
            takePictureLauncher.launch(uri)
          } catch (_: android.content.ActivityNotFoundException) {
            runCatching { pendingCaptureFile?.delete() }
            clearCaptureFlow()
            scope.launch { snackbarHost.showSnackbar(cameraFailed) }
          }
        }
      } else {
        runCatching { pendingCaptureFile?.delete() }
        clearCaptureFlow()
        scope.launch { snackbarHost.showSnackbar(cameraPermMsg) }
      }
    }

  suspend fun prepareThenOpenCapture(target: String) {
    keyboard?.hide()
    @Suppress("DEPRECATION")
    val imm = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.hideSoftInputFromWindow(view.windowToken, 0)
    focusManager.clearFocus(true)
    delay(200)

    val file = File(app.cacheDir, "fuel-${System.currentTimeMillis()}.jpg")
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
      try {
        takePictureLauncher.launch(uri)
      } catch (_: android.content.ActivityNotFoundException) {
        runCatching { file.delete() }
        clearCaptureFlow()
        scope.launch { snackbarHost.showSnackbar(cameraFailed) }
      }
    } else {
      permissionLauncher.launch(Manifest.permission.CAMERA)
    }
  }

  LaunchedEffect(state.message) {
    val msg = state.message ?: return@LaunchedEffect
    snackbarHost.showSnackbar(msg)
  }

  // Bitta scroll: weight+scroll o‘rniga — klaviatura/hisoblashda «Машина расми» yo‘qolmaydi; «Юбориш» ham ustma-ust emas.
  val scroll = rememberScrollState()
  Column(
    modifier =
      modifier
        .fillMaxSize()
        .padding(16.dp)
        .imePadding()
        .verticalScroll(scroll),
  ) {
    OutlinedTextField(
        modifier = Modifier.fillMaxWidth(),
        value = state.amount,
        onValueChange = vm::setAmount,
        label = { Text(stringResource(R.string.amount_field)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions =
          KeyboardActions(
            onDone = {
              keyboard?.hide()
              focusManager.clearFocus(true)
            },
          ),
      )

      Spacer(Modifier.height(12.dp))
      if (state.vehiclePhoto == null && captureTarget != "vehicle") {
        Button(
          modifier = Modifier.fillMaxWidth(),
          enabled = amountHasDigits,
          onClick = { scope.launch { prepareThenOpenCapture("vehicle") } },
        ) {
          Text(stringResource(R.string.vehicle_photo))
        }
      } else if (state.vehiclePhoto == null && captureTarget == "vehicle") {
        Spacer(Modifier.height(8.dp))
        Text(
          stringResource(R.string.camera_opening),
          style = MaterialTheme.typography.bodyMedium,
        )
      } else if (captureTarget != "vehicle") {
        Spacer(Modifier.height(8.dp))
        PhotoAttachmentRow(
          title = stringResource(R.string.vehicle_photo),
          file = state.vehiclePhoto!!,
          onRetake = { scope.launch { prepareThenOpenCapture("vehicle") } },
          onRemove = { vm.clearVehiclePhoto() },
          retakeEnabled = amountHasDigits,
        )
      }

      Spacer(Modifier.height(12.dp))
      val canAddReceipt = state.vehiclePhoto != null
      if (state.receiptPhoto == null && captureTarget != "receipt") {
        Button(
          modifier = Modifier.fillMaxWidth(),
          enabled = canAddReceipt,
          onClick = { scope.launch { prepareThenOpenCapture("receipt") } },
        ) {
          Text(stringResource(R.string.receipt_photo))
        }
      } else if (state.receiptPhoto == null && captureTarget == "receipt") {
        Spacer(Modifier.height(8.dp))
        Text(
          stringResource(R.string.camera_opening),
          style = MaterialTheme.typography.bodyMedium,
        )
      } else if (captureTarget != "receipt") {
        Spacer(Modifier.height(8.dp))
        PhotoAttachmentRow(
          title = stringResource(R.string.receipt_photo),
          file = state.receiptPhoto!!,
          onRetake = { scope.launch { prepareThenOpenCapture("receipt") } },
          onRemove = { vm.clearReceiptPhoto() },
        )
      }

    Spacer(Modifier.height(24.dp))
    Button(
      modifier = Modifier.fillMaxWidth(),
      enabled = canSubmit,
      onClick = vm::submit,
    ) {
      if (state.loading) {
        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.height(18.dp))
      }
      Text(if (state.loading) stringResource(R.string.sending) else stringResource(R.string.send))
    }
    Spacer(Modifier.height(32.dp))
  }
}
