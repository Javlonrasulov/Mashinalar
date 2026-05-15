package com.mashinalar.driver.notifications

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.auth.TokenStore
import com.mashinalar.driver.data.reports.ReportsRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import com.mashinalar.driver.util.AppZone
import kotlinx.coroutines.flow.first

@HiltWorker
class DailyKmEndReminderWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val tokenStore: TokenStore,
  private val reports: ReportsRepository,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val token = tokenStore.tokenFlow.first().orEmpty()
    if (token.isBlank()) return Result.success()

    val today = AppZone.today().toString()
    val shouldNotify =
      when (val r = reports.myDailyKmReports(7)) {
        is ApiResult.Ok -> {
          val todayRow = r.value.firstOrNull { it.reportDate.trim().startsWith(today) }
          todayRow != null && todayRow.endKm.isNullOrBlank()
        }
        is ApiResult.Err -> true // if we can't verify, still remind
      }

    if (shouldNotify) {
      AlertNotifier.showDailyKmEnd(applicationContext)
    }
    return Result.success()
  }
}

