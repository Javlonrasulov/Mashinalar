package com.mashinalar.driver.ui.permissions

import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

@Composable
fun PermissionGate(
  permission: String,
  rationale: String,
  content: @Composable () -> Unit,
) {
  val ctx = LocalContext.current
  var granted by remember {
    mutableStateOf(
      ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED,
    )
  }

  val launcher = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { ok ->
    granted = ok
  }

  LaunchedEffect(Unit) {
    if (!granted) launcher.launch(permission)
  }

  if (granted) {
    content()
  } else {
    Button(onClick = { launcher.launch(permission) }) {
      Text(rationale)
    }
  }
}

