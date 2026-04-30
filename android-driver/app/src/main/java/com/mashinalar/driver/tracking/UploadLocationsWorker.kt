package com.mashinalar.driver.tracking

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.mashinalar.driver.data.db.GpsOffSegmentDao
import com.mashinalar.driver.data.db.LocationPointDao
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.BatchGpsOffSegmentsRequest
import com.mashinalar.driver.data.network.BatchLocationRequest
import com.mashinalar.driver.data.network.GpsOffSegmentUploadDto
import com.mashinalar.driver.data.network.LocationPointDto
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant

@HiltWorker
class UploadLocationsWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val dao: LocationPointDao,
  private val gpsDao: GpsOffSegmentDao,
  private val api: ApiService,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    return try {
      uploadLocationBatches()
      uploadGpsOffBatches()
      Result.success()
    } catch (e: retrofit2.HttpException) {
      if (e.code() == 401 || e.code() == 403) Result.failure() else Result.retry()
    } catch (_: Throwable) {
      Result.retry()
    }
  }

  private suspend fun uploadLocationBatches() {
    val before = System.currentTimeMillis() - 3L * 24 * 60 * 60 * 1000
    while (true) {
      val batch = dao.getByStatus(status = "PENDING", limit = 50)
      if (batch.isEmpty()) break
      val points =
        batch.map {
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
      dao.deleteSentBefore(before)
      if (batch.size < 50) break
    }
  }

  private suspend fun uploadGpsOffBatches() {
    val before = System.currentTimeMillis() - 3L * 24 * 60 * 60 * 1000
    while (true) {
      val batch = gpsDao.getPending(limit = 50)
      if (batch.isEmpty()) break
      val segments =
        batch.map { row ->
          GpsOffSegmentUploadDto(
            startedAt = Instant.ofEpochMilli(row.startMs).toString(),
            endedAt = Instant.ofEpochMilli(row.endMs!!).toString(),
          )
        }
      api.sendGpsOffSegments(BatchGpsOffSegmentsRequest(segments))
      gpsDao.markSent(batch.map { it.id })
      gpsDao.deleteSentBefore(before)
      if (batch.size < 50) break
    }
  }
}
