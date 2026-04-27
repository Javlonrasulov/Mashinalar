package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.R
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun TasksScreen(
  onSubmit: (String) -> Unit,
  snackbarHost: SnackbarHostState,
  modifier: Modifier = Modifier,
  vm: TasksViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()

  LaunchedEffect(Unit) { vm.refresh() }

  Column(
    modifier = modifier
      .fillMaxSize()
      .padding(16.dp)
      .imePadding(),
  ) {
    Text(stringResource(R.string.tasks_title))
    Spacer(Modifier.height(8.dp))
    Button(modifier = Modifier.fillMaxWidth(), onClick = vm::refresh) { Text(stringResource(R.string.refresh)) }
    Spacer(Modifier.height(8.dp))

    state.error?.let { Text(it) }

    LazyColumn(modifier = Modifier.weight(1f)) {
      items(state.tasks) { t ->
        val daysLeft = runCatching {
          val d = Instant.parse(t.deadlineAt)
          ChronoUnit.DAYS.between(Instant.now(), d)
        }.getOrNull()

        val openSubmit = taskOpensSubmitScreen(t.status)

        Card(
          modifier =
            Modifier
              .fillMaxWidth()
              .padding(vertical = 6.dp)
              .then(
                if (openSubmit) {
                  Modifier.clickable { onSubmit(t.id) }
                } else {
                  Modifier
                },
              ),
          colors = taskCardColorsForStatus(t.status),
        ) {
          Column(modifier = Modifier.padding(12.dp)) {
            Text(t.title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(6.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
              Text("${stringResource(R.string.status)}: ${taskStatusLabel(t.status)}")
              Spacer(Modifier.weight(1f))
              Text("${stringResource(R.string.days_left)}: ${daysLeft ?: "—"}")
            }
            Spacer(Modifier.height(8.dp))
            kvRow(stringResource(R.string.home_tasks_deadline), formatIsoDateOnly(t.deadlineAt))
            t.submittedAt?.takeIf { it.isNotBlank() }?.let {
              kvRow(stringResource(R.string.task_sent_at), formatIsoDateTime(it))
            }
            t.reviewedAt?.takeIf { it.isNotBlank() }?.let {
              kvRow(stringResource(R.string.task_reviewed_at), formatIsoDateTime(it))
            }
          }
        }
      }
    }
  }
}

private fun taskOpensSubmitScreen(status: String): Boolean =
  when (status.uppercase()) {
    "PENDING", "REJECTED" -> true
    else -> false
  }

@Composable
private fun kvRow(label: String, value: String) {
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
    Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(value, style = MaterialTheme.typography.bodySmall)
  }
  Spacer(Modifier.height(4.dp))
}

private fun formatIsoDateOnly(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  return runCatching {
    val i = Instant.parse(iso)
    val z = ZoneId.systemDefault()
    DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(z).format(i)
  }.getOrElse { "—" }
}

private fun formatIsoDateTime(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  return runCatching {
    val i = Instant.parse(iso)
    val z = ZoneId.systemDefault()
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(z).format(i)
  }.getOrElse { "—" }
}

@Composable
private fun taskStatusLabel(raw: String): String =
  when (raw.uppercase()) {
    "PENDING" -> stringResource(R.string.task_status_pending)
    "SUBMITTED" -> stringResource(R.string.task_status_submitted)
    "APPROVED" -> stringResource(R.string.task_status_approved)
    "REJECTED" -> stringResource(R.string.task_status_rejected)
    else -> raw
  }

/** Vazifa holatiga qarab kartaning fon/matn ranglari (bajarilmagan / jarayonda / tasdiqlangan / rad). */
@Composable
private fun taskCardColorsForStatus(status: String) =
  when (status.uppercase()) {
    "PENDING" ->
      CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
      )
    "SUBMITTED" ->
      CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
      )
    "APPROVED" ->
      if (isSystemInDarkTheme()) {
        CardDefaults.cardColors(
          containerColor = Color(0xFF1B3D2D),
          contentColor = Color(0xFFB9F6CA),
        )
      } else {
        CardDefaults.cardColors(
          containerColor = Color(0xFFC8E6C9),
          contentColor = Color(0xFF1B5E20),
        )
      }
    "REJECTED" ->
      CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
      )
    else -> CardDefaults.cardColors()
  }
