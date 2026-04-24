package com.mashinalar.driver.ui.screens

import android.Manifest
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.mashinalar.driver.R
import com.mashinalar.driver.ui.components.ButtonSendProgressContent
import com.mashinalar.driver.ui.camera.CameraCapture
import com.mashinalar.driver.ui.components.PhotoAttachmentRow
import com.mashinalar.driver.ui.permissions.PermissionGate
import com.mashinalar.driver.util.absoluteUploadUrl
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun OilScreen(
  snackbarHost: SnackbarHostState,
  modifier: Modifier = Modifier,
  vm: OilViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  var capture by remember { mutableStateOf(false) }

  DisposableEffect(Unit) {
    onDispose { vm.clearMessage() }
  }

  LaunchedEffect(state.message) {
    val msg = state.message ?: return@LaunchedEffect
    snackbarHost.showSnackbar(msg)
    vm.clearMessage()
  }

  Column(
    modifier =
      modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(16.dp)
        .imePadding(),
  ) {
    when {
      state.loading ->
        Column(modifier = Modifier.fillMaxWidth()) {
          CircularProgressIndicator()
          Spacer(Modifier.height(8.dp))
          Text(stringResource(R.string.loading))
        }
      state.error != null -> {
        Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = { vm.refresh() }) { Text(stringResource(R.string.refresh)) }
      }
      else -> {
        val oil = state.summary?.oil
        val v = state.summary?.vehicle
        ElevatedCard(modifier = Modifier.fillMaxWidth()) {
          Column(Modifier.padding(12.dp)) {
            Text(stringResource(R.string.oil_summary_title), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(6.dp))
            if (v != null) {
              Text("${v.plateNumber} · ${v.name}", style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(4.dp))
            oil?.let { o ->
              Text(
                stringResource(
                  R.string.oil_line_last,
                  o.lastOilChangeKm?.let { formatNum(it) } ?: "—",
                ),
              )
              Text(
                stringResource(
                  R.string.oil_line_interval,
                  o.oilChangeIntervalKm?.toString() ?: "—",
                ),
              )
              Text(
                stringResource(
                  R.string.oil_line_estimated,
                  o.estimatedCurrentKm?.let { formatNum(it) } ?: "—",
                ),
              )
              Text(
                stringResource(
                  R.string.oil_line_next,
                  o.nextOilChangeKm?.let { formatNum(it) } ?: "—",
                ),
              )
              Text(
                stringResource(
                  R.string.oil_line_remaining,
                  o.kmRemainingToNext?.let { formatNum(it) } ?: "—",
                ),
              )
              Text(
                text = urgencyLabel(o.oilUrgency),
                style = MaterialTheme.typography.titleSmall,
                color = urgencyColor(o.oilUrgency),
              )
            } ?: Text(stringResource(R.string.oil_no_vehicle))
          }
        }

        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.oil_new_title), style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
          value = state.kmInput,
          onValueChange = vm::setKm,
          label = { Text(stringResource(R.string.oil_km_at_change)) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        if (state.panelPhoto == null) {
          Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = { capture = true },
          ) {
            Text(stringResource(R.string.oil_add_panel_photo))
          }
        } else if (!capture) {
          PhotoAttachmentRow(
            title = stringResource(R.string.oil_panel_photo),
            file = state.panelPhoto!!,
            onRetake = { capture = true },
            onRemove = { vm.clearPanelPhoto() },
          )
        }

        if (capture) {
          Spacer(Modifier.height(8.dp))
          PermissionGate(
            permission = Manifest.permission.CAMERA,
            rationale = stringResource(R.string.camera_permission),
          ) {
            CameraCapture(
              onCaptured = { f ->
                vm.setPanelPhoto(f)
                capture = false
              },
              onError = { capture = false },
            )
          }
        }

        Spacer(Modifier.height(12.dp))
        val canSubmit =
          state.kmInput.any { it.isDigit() } && state.panelPhoto != null && !state.submitLoading
        Button(
          modifier = Modifier.fillMaxWidth(),
          enabled = canSubmit,
          onClick = { vm.submit() },
        ) {
          ButtonSendProgressContent(loading = state.submitLoading)
        }

        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.oil_history_title), style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(6.dp))
        if (state.history.isEmpty()) {
          Text(stringResource(R.string.oil_history_empty), style = MaterialTheme.typography.bodyMedium)
        } else {
          for (row in state.history) {
            ElevatedCard(
              modifier =
                Modifier
                  .fillMaxWidth()
                  .padding(vertical = 4.dp),
            ) {
              Column(Modifier.padding(10.dp)) {
                Text(
                  formatHistoryDate(row.createdAt),
                  style = MaterialTheme.typography.labelMedium,
                )
                Text(
                  stringResource(R.string.oil_history_km, row.kmAtChange),
                  style = MaterialTheme.typography.bodyLarge,
                )
                val url = absoluteUploadUrl(row.photoUrl)
                if (url != null) {
                  Spacer(Modifier.height(6.dp))
                  AsyncImage(
                    model = url,
                    contentDescription = null,
                    modifier =
                      Modifier
                        .height(120.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop,
                  )
                }
              }
            }
          }
        }
      }
    }
  }
}

private fun formatNum(d: Double): String {
  val v = if (d % 1.0 == 0.0) d.toLong().toString() else String.format("%.1f", d)
  return v
}

@Composable
private fun urgencyLabel(raw: String?): String =
  when (raw?.lowercase()) {
    "overdue" -> stringResource(R.string.oil_urgency_overdue)
    "soon" -> stringResource(R.string.oil_urgency_soon)
    "ok" -> stringResource(R.string.oil_urgency_ok)
    else -> stringResource(R.string.oil_urgency_unknown)
  }

@Composable
private fun urgencyColor(raw: String?): Color =
  when (raw?.lowercase()) {
    "overdue" -> MaterialTheme.colorScheme.error
    "soon" -> MaterialTheme.colorScheme.tertiary
    "ok" -> MaterialTheme.colorScheme.primary
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }

private fun formatHistoryDate(iso: String): String =
  runCatching {
    val z = ZoneId.systemDefault()
    val d = Instant.parse(iso).atZone(z).toLocalDate()
    DateTimeFormatter.ofPattern("yyyy-MM-dd").format(d)
  }.getOrElse { iso }
