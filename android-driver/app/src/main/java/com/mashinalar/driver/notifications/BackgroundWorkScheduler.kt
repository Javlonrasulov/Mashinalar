package com.mashinalar.driver.notifications

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object BackgroundWorkScheduler {
  /** Vazifa / KM tekshiruvi — ilova yopiq bo‘lsa ham (tarmoq + token bo‘lsa). */
  fun enqueueTaskCheckNow(context: Context) {
    val req =
      OneTimeWorkRequestBuilder<TaskAssignedWorker>()
        .setConstraints(TaskAssignedWorker.constraints())
        .build()
    WorkManager.getInstance(context).enqueueUniqueWork(
      "task_assigned_check_now",
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }
}
