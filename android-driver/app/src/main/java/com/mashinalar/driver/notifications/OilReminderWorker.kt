package com.mashinalar.driver.notifications

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.WorkerParameters
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.auth.TokenStore
import com.mashinalar.driver.data.reports.ReportsRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first

@HiltWorker
class OilReminderWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val tokenStore: TokenStore,
  private val reports: ReportsRepository,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val token = tokenStore.tokenFlow.first().orEmpty()
    if (token.isBlank()) return Result.success()

    return when (val r = reports.myVehicle()) {
      is ApiResult.Err -> Result.retry()
      is ApiResult.Ok -> {
        val oil = r.value.oil ?: return Result.success()
        val u = oil.oilUrgency?.lowercase() ?: "unknown"
        when (u) {
          "overdue" -> AlertNotifier.showOilOverdue(applicationContext)
          "soon" -> AlertNotifier.showOilSoon(applicationContext)
          else -> { /* ok / unknown — bildirishnoma yo‘q */ }
        }
        Result.success()
      }
    }
  }

  companion object {
    fun constraints(): Constraints =
      Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
  }
}
