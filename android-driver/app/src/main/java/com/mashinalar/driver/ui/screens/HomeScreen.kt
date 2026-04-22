package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.StackedLineChart
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.R
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun HomeScreen(
  vm: HomeViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  val payload = state.vehicle
  val veh = payload?.vehicle
  val oil = payload?.oil
  val insurance = payload?.insurance

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp)
      .imePadding(),
  ) {
    Text(stringResource(R.string.home_title), style = MaterialTheme.typography.headlineSmall)
    Spacer(Modifier.height(12.dp))
    OutlinedButton(onClick = vm::refresh, enabled = !state.loading) {
      Text(stringResource(R.string.refresh))
    }

    Spacer(Modifier.height(12.dp))

    if (state.loading) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        CircularProgressIndicator()
      }
      return@Column
    }

    state.error?.let {
      Text(it, color = MaterialTheme.colorScheme.error)
      Spacer(Modifier.height(12.dp))
    }

    // Vehicle
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Filled.DirectionsCar, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text(stringResource(R.string.home_vehicle_card_title), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        if (veh == null) {
          Text(stringResource(R.string.home_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          Text("${veh.plateNumber} — ${veh.name}")
        }
      }
    }

    Spacer(Modifier.height(12.dp))

    // Oil
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Filled.LocalFireDepartment, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text(stringResource(R.string.home_oil_card_title), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        if (oil == null) {
          Text(stringResource(R.string.home_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          kvRow(stringResource(R.string.home_oil_last_km), formatKm(oil.lastOilChangeKm))
          kvRow(stringResource(R.string.home_oil_last_at), formatIsoDate(oil.lastOilChangeAt))
          kvRow(stringResource(R.string.home_oil_next_km), formatKm(oil.nextOilChangeKm))
        }
      }
    }

    Spacer(Modifier.height(12.dp))

    // Insurance
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            Icons.Filled.Shield,
            contentDescription = null,
            tint = if (insurance?.isWarn == true) Color(0xFFB91C1C) else MaterialTheme.colorScheme.primary,
          )
          Spacer(Modifier.width(10.dp))
          Text(stringResource(R.string.home_insurance_card_title), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        if (insurance == null) {
          Text(stringResource(R.string.home_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          kvRow(stringResource(R.string.home_insurance_end), formatIsoDate(insurance.insuranceEndDate))
          if (insurance.isWarn) {
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.home_insurance_warn), color = Color(0xFFB91C1C))
          }
        }
      }
    }

    Spacer(Modifier.height(12.dp))

    // Stats
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Filled.StackedLineChart, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text(stringResource(R.string.home_stats_title), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        val stats = state.stats
        kvRow(stringResource(R.string.home_stats_last3), formatKm(stats?.totalLastDays))
        kvRow(stringResource(R.string.home_stats_today), formatKm(stats?.todayKm))
      }
    }

    Spacer(Modifier.height(12.dp))

    // Tasks
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Filled.TaskAlt, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text(stringResource(R.string.home_tasks_title), style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        if (state.tasks.isEmpty()) {
          Text(stringResource(R.string.home_tasks_empty))
        } else {
          state.tasks.forEach { t ->
            val deadline = formatIsoDate(t.deadlineAt)
            val daysLeft = daysLeftToDeadline(t.deadlineAt)
            Column(modifier = Modifier.padding(vertical = 8.dp)) {
              Text(t.title, style = MaterialTheme.typography.titleSmall)
              Spacer(Modifier.height(4.dp))
              kvRow(stringResource(R.string.home_tasks_deadline), deadline)
              kvRow(stringResource(R.string.days_left), daysLeft ?: "—")
            }
          }
        }
      }
    }
  }
}

@Composable
private fun kvRow(label: String, value: String) {
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(value)
  }
  Spacer(Modifier.height(8.dp))
}

private fun formatIsoDate(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  return runCatching {
    val i = Instant.parse(iso)
    val z = ZoneId.systemDefault()
    DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(z).format(i)
  }.getOrDefault("—")
}

private fun formatKm(value: Double?): String {
  if (value == null || !value.isFinite()) return "—"
  val v = kotlin.math.round(value).toLong()
  return v.toString()
}

private fun daysLeftToDeadline(deadlineIso: String): String? {
  return runCatching {
    val deadlineInstant = Instant.parse(deadlineIso)
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val deadlineDate = deadlineInstant.atZone(zone).toLocalDate()
    ChronoUnit.DAYS.between(today, deadlineDate).toString()
  }.getOrNull()
}
