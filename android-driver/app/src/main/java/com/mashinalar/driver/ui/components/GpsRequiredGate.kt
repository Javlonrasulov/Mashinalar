package com.mashinalar.driver.ui.components

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.mashinalar.driver.R
import com.mashinalar.driver.tracking.Gps

/**
 * Shows a non-dismissible full-screen dialog while device location (GPS/network provider) is off.
 * Underlying UI stays in composition but cannot be interacted with.
 */
@Composable
fun GpsRequiredGate(content: @Composable () -> Unit) {
  val context = LocalContext.current
  var gpsOn by remember { mutableStateOf(Gps.isEnabled(context)) }
  val lifecycleOwner = LocalLifecycleOwner.current

  fun refreshGps() {
    gpsOn = Gps.isEnabled(context)
  }

  DisposableEffect(lifecycleOwner) {
    val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(c: Context?, intent: Intent?) {
          refreshGps()
        }
      }
    val filter = IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION)
    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)

    val observer = LifecycleEventObserver { _, event ->
      if (event == Lifecycle.Event.ON_RESUME) refreshGps()
    }
    lifecycleOwner.lifecycle.addObserver(observer)

    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
      runCatching { context.unregisterReceiver(receiver) }
    }
  }

  BackHandler(enabled = !gpsOn) { /* block back — must enable location */ }

  content()

  if (!gpsOn) {
    Dialog(
      onDismissRequest = {},
      properties =
        DialogProperties(
          dismissOnBackPress = false,
          dismissOnClickOutside = false,
          usePlatformDefaultWidth = false,
        ),
    ) {
      Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.surface,
      ) {
        Column(
          modifier =
            Modifier
              .fillMaxSize()
              .padding(24.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          Text(
            text = stringResource(R.string.location_gate_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
          )
          Spacer(Modifier.height(16.dp))
          Text(
            text = stringResource(R.string.location_gate_body),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Spacer(Modifier.height(24.dp))
          Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
              runCatching {
                context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
              }
            },
          ) {
            Text(stringResource(R.string.open_location_settings))
          }
        }
      }
    }
  }
}
