package com.mashinalar.driver.tracking

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mashinalar.driver.data.db.LocationPointDao
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.BatchLocationRequest
import com.mashinalar.driver.data.network.LocationPointDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant

@HiltWorker
class UploadLocationsWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val dao: LocationPointDao,
  private val api: ApiService,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val batch = dao.getByStatus(status = "PENDING", limit = 50)
    if (batch.isEmpty()) return Result.success()

    return try {
      val points = batch.map {
        LocationPointDto(
          latitude = it.latitude,
          longitude = it.longitude,
          accuracyM = it.accuracyM,
          speed = it.speed,
          heading = it.heading,
          recordedAt = Instant.ofEpochMilli(it.recordedAtMs).toString(),
        )
      }
      api.sendLocations(BatchLocationRequest(points))
      dao.markSent(batch.map { it.id })

      // keep db small: delete old sent points (3 days)
      val before = System.currentTimeMillis() - 3L * 24 * 60 * 60 * 1000
      dao.deleteSentBefore(before)

      Result.success()
    } catch (e: retrofit2.HttpException) {
      // 401/403: token invalid — don't spin forever
      if (e.code() == 401 || e.code() == 403) Result.failure() else Result.retry()
    } catch (_: Throwable) {
      Result.retry()
    }
  }
}

