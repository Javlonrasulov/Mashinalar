package com.mashinalar.driver.notifications

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.WorkerParameters
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.auth.TokenStore
import com.mashinalar.driver.data.tasks.TasksRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.flow.first

@HiltWorker
class TaskAssignedWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val tokenStore: TokenStore,
  private val tasks: TasksRepository,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val token = tokenStore.tokenFlow.first().orEmpty()
    if (token.isBlank()) return Result.success()

    val prefs = applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val initialized = prefs.getBoolean(KEY_INITIALIZED, false)
    val known = prefs.getStringSet(KEY_KNOWN_ACTIVE_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()

    val active =
      when (val r = tasks.myActiveTasks()) {
        is ApiResult.Ok -> r.value
        is ApiResult.Err -> return Result.retry()
      }

    val activeIds = active.map { it.id }.toSet()
    if (!initialized) {
      prefs
        .edit()
        .putStringSet(KEY_KNOWN_ACTIVE_IDS, activeIds)
        .putBoolean(KEY_INITIALIZED, true)
        .apply()
      return Result.success()
    }

    val newIds = activeIds - known
    if (newIds.isNotEmpty()) {
      AlertNotifier.showNewTasks(applicationContext, newIds.size)
    }

    prefs.edit().putStringSet(KEY_KNOWN_ACTIVE_IDS, activeIds).apply()
    return Result.success()
  }

  companion object {
    private const val PREFS = "task_notifier"
    private const val KEY_KNOWN_ACTIVE_IDS = "known_active_ids"
    private const val KEY_INITIALIZED = "initialized"

    fun resetKnownTasks(context: Context) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .remove(KEY_KNOWN_ACTIVE_IDS)
        .remove(KEY_INITIALIZED)
        .apply()
    }

    fun constraints(): Constraints =
      Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
  }
}

