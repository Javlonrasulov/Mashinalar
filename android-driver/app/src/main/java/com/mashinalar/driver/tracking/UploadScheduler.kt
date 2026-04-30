package com.mashinalar.driver.tracking

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object UploadScheduler {
  fun enqueueNow(context: Context) {
    val req = OneTimeWorkRequestBuilder<UploadLocationsWorker>()
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build(),
      )
      .setBackoffCriteria(
        androidx.work.BackoffPolicy.EXPONENTIAL,
        20,
        TimeUnit.SECONDS,
      )
      .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      "upload_locations_now",
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }
}

