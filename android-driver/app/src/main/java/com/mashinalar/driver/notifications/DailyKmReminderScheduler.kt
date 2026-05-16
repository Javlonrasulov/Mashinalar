package com.mashinalar.driver.notifications

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.mashinalar.driver.util.NetworkTimeProvider
import java.time.Duration
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

/**
 * Kunlik KM eslatmalari **Asia/Tashkent** bo‘yicha aniq soatda.
 * Kechikish hisobi uchun vaqt **server HTTP Date** (`/health`) orqali olinadi;
 * tarmoq bo‘lmasa — qurilma vaqti.
 */
object DailyKmReminderScheduler {
  private const val UNIQUE_START = "daily_km_start_reminder"
  private const val UNIQUE_END = "daily_km_end_reminder"

  suspend fun millisUntilNextWallClock(hour: Int, minute: Int): Long {
    val now = NetworkTimeProvider.nowZonedTashkent()
    var next =
      now
        .truncatedTo(ChronoUnit.DAYS)
        .withHour(hour)
        .withMinute(minute)
        .withSecond(0)
        .withNano(0)
    if (!next.isAfter(now)) next = next.plusDays(1)
    return Duration.between(now, next).toMillis().coerceAtLeast(TimeUnit.MINUTES.toMillis(1))
  }

  suspend fun scheduleStart(context: Context) {
    val delay = millisUntilNextWallClock(7, 0)
    val req =
      OneTimeWorkRequestBuilder<DailyKmStartReminderWorker>()
        .setInitialDelay(delay, TimeUnit.MILLISECONDS)
        .build()
    WorkManager.getInstance(context).enqueueUniqueWork(
      UNIQUE_START,
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }

  suspend fun scheduleEnd(context: Context) {
    val delay = millisUntilNextWallClock(20, 0)
    val req =
      OneTimeWorkRequestBuilder<DailyKmEndReminderWorker>()
        .setInitialDelay(delay, TimeUnit.MILLISECONDS)
        .build()
    WorkManager.getInstance(context).enqueueUniqueWork(
      UNIQUE_END,
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }
}
