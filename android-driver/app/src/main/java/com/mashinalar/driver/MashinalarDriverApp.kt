package com.mashinalar.driver

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.mashinalar.driver.data.local.LanguageStore
import com.mashinalar.driver.notifications.DailyKmEndReminderWorker
import com.mashinalar.driver.notifications.DailyKmStartReminderWorker
import com.mashinalar.driver.notifications.OilReminderWorker
import com.mashinalar.driver.notifications.TaskAssignedWorker
import com.mashinalar.driver.tracking.NetworkUploadTrigger
import com.mashinalar.driver.util.LocaleManager
import dagger.hilt.android.HiltAndroidApp
import java.time.Duration
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

@HiltAndroidApp
class MashinalarDriverApp : Application() {
  @Inject lateinit var workerFactory: HiltWorkerFactory
  @Inject lateinit var languageStore: LanguageStore

  override fun onCreate() {
    super.onCreate()

    // Avtomatik WorkManager initializer o‘chirilgan — Hilt [HiltWorkerFactory] bilan shu yerda init qilamiz.
    val wmConfig = Configuration.Builder().setWorkerFactory(workerFactory).build()
    WorkManager.initialize(this, wmConfig)
    NetworkUploadTrigger.register(this)

    // Apply saved locale before UI renders (default uz-Cyrl).
    runBlocking {
      LocaleManager.applyLanguageTag(languageStore.languageTagFlow.first())
    }
    scheduleLocationUploads()
    scheduleOilReminders()
    scheduleDailyKmReminders()
    scheduleTaskAssignedNotifications()
  }

  private fun scheduleLocationUploads() {
    val req =
      PeriodicWorkRequestBuilder<com.mashinalar.driver.tracking.UploadLocationsWorker>(
          15,
          TimeUnit.MINUTES,
        )
        .setConstraints(
          Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
        )
        .build()

    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "upload_locations",
      ExistingPeriodicWorkPolicy.UPDATE,
      req,
    )
  }

  private fun scheduleOilReminders() {
    val req =
      PeriodicWorkRequestBuilder<OilReminderWorker>(12, TimeUnit.HOURS)
        .setConstraints(OilReminderWorker.constraints())
        .build()
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "oil_reminders",
      ExistingPeriodicWorkPolicy.UPDATE,
      req,
    )
  }

  private fun scheduleDailyKmReminders() {
    fun delayUntil(hour: Int, minute: Int): Duration {
      val now = ZonedDateTime.now()
      var next =
        now
          .truncatedTo(ChronoUnit.DAYS)
          .withHour(hour)
          .withMinute(minute)
          .withSecond(0)
          .withNano(0)
      if (!next.isAfter(now)) next = next.plusDays(1)
      return Duration.between(now, next)
    }

    val startReq =
      PeriodicWorkRequestBuilder<DailyKmStartReminderWorker>(24, TimeUnit.HOURS)
        .setInitialDelay(delayUntil(7, 0).toMillis(), TimeUnit.MILLISECONDS)
        .build()
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "daily_km_start_reminder",
      ExistingPeriodicWorkPolicy.UPDATE,
      startReq,
    )

    val endReq =
      PeriodicWorkRequestBuilder<DailyKmEndReminderWorker>(24, TimeUnit.HOURS)
        .setInitialDelay(delayUntil(20, 0).toMillis(), TimeUnit.MILLISECONDS)
        .build()
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "daily_km_end_reminder",
      ExistingPeriodicWorkPolicy.UPDATE,
      endReq,
    )
  }

  private fun scheduleTaskAssignedNotifications() {
    val req =
      PeriodicWorkRequestBuilder<TaskAssignedWorker>(15, TimeUnit.MINUTES)
        .setConstraints(TaskAssignedWorker.constraints())
        .build()
    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
      "task_assigned_notifier",
      ExistingPeriodicWorkPolicy.UPDATE,
      req,
    )
  }
}

