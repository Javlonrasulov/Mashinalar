package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.R
import java.time.Instant
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

        Card(
          modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable { onSubmit(t.id) },
        ) {
          Column(modifier = Modifier.padding(12.dp)) {
            Text(t.title)
            Spacer(Modifier.height(4.dp))
            Row {
              Text("${stringResource(R.string.status)}: ${taskStatusLabel(t.status)}")
              Spacer(Modifier.weight(1f))
              Text("${stringResource(R.string.days_left)}: ${daysLeft ?: "-"}")
            }
          }
        }
      }
    }
  }
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
