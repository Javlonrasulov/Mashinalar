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
import com.mashinalar.driver.util.LocaleManager
import dagger.hilt.android.HiltAndroidApp
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

    // Apply saved locale before UI renders (default uz-Cyrl).
    runBlocking {
      LocaleManager.applyLanguageTag(languageStore.languageTagFlow.first())
    }
    scheduleLocationUploads()
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
}
