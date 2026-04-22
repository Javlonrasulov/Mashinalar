package com.mashinalar.driver.ui.screens

import android.Manifest
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.imePadding
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.ui.camera.CameraCapture
import com.mashinalar.driver.ui.components.PhotoAttachmentRow
import com.mashinalar.driver.ui.permissions.PermissionGate
import com.mashinalar.driver.R

@Composable
fun TaskSubmitScreen(
  taskId: String,
  onDone: () -> Unit,
  snackbarHost: SnackbarHostState,
  modifier: Modifier = Modifier,
  vm: TaskSubmitViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  var capture by remember { mutableStateOf(false) }

  LaunchedEffect(state.message) {
    val msg = state.message ?: return@LaunchedEffect
    snackbarHost.showSnackbar(msg)
  }

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
      OutlinedTextField(
        modifier = Modifier.fillMaxWidth(),
        value = state.proofText,
        onValueChange = vm::setProofText,
        label = { Text(stringResource(R.string.comment_optional)) },
      )

      Spacer(Modifier.height(8.dp))
      if (state.proofPhoto == null) {
        Button(modifier = Modifier.fillMaxWidth(), onClick = { capture = true }) {
          Text(stringResource(R.string.add_photo))
        }
      } else if (!capture) {
        Spacer(Modifier.height(8.dp))
        PhotoAttachmentRow(
          title = stringResource(R.string.add_photo),
          file = state.proofPhoto!!,
          onRetake = { capture = true },
          onRemove = { vm.clearProofPhoto() },
        )
      }

      if (capture) {
        Spacer(Modifier.height(12.dp))
        PermissionGate(
          permission = Manifest.permission.CAMERA,
          rationale = stringResource(R.string.camera_permission),
        ) {
          CameraCapture(
            onCaptured = { f ->
              vm.setProofPhoto(f)
              capture = false
            },
            onError = { capture = false },
          )
        }
      }

      Spacer(Modifier.height(72.dp))
    }

    Button(
      modifier = Modifier
        .fillMaxWidth()
        .align(Alignment.BottomCenter),
      enabled = !state.loading,
      onClick = {
        vm.submit(taskId)
      },
    ) {
      if (state.loading) CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.height(18.dp))
      Text(if (state.loading) stringResource(R.string.sending) else stringResource(R.string.send))
    }
  }
}

