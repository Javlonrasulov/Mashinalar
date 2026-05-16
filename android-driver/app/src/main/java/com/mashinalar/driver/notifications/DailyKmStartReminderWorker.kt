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
import com.mashinalar.driver.util.NetworkTimeProvider
import kotlinx.coroutines.flow.first

@HiltWorker
class DailyKmStartReminderWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val tokenStore: TokenStore,
  private val reports: ReportsRepository,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    try {
      val token = tokenStore.tokenFlow.first().orEmpty()
      if (token.isBlank()) return Result.success()

      val today = NetworkTimeProvider.nowZonedTashkent().toLocalDate().toString()
      val shouldNotify =
        when (val r = reports.myDailyKmReports(7)) {
          is ApiResult.Ok -> r.value.none { it.reportDate.trim().startsWith(today) }
          is ApiResult.Err -> true // if we can't verify, still remind
        }

      if (shouldNotify) {
        AlertNotifier.showDailyKmStart(applicationContext)
      }
      return Result.success()
    } finally {
      DailyKmReminderScheduler.scheduleStart(applicationContext)
    }
  }
}

