package com.mashinalar.driver.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface GpsOffSegmentDao {
  @Insert
  suspend fun insert(row: GpsOffSegmentEntity): Long

  @Query("SELECT * FROM gps_off_segments WHERE status = 'OPEN' LIMIT 1")
  suspend fun getOpen(): GpsOffSegmentEntity?

  @Query("DELETE FROM gps_off_segments WHERE status = 'OPEN'")
  suspend fun deleteAllOpen(): Int

  @Query("UPDATE gps_off_segments SET endMs = :endMs, status = 'PENDING' WHERE status = 'OPEN'")
  suspend fun closeAllOpen(endMs: Long): Int

  @Query(
    "SELECT * FROM gps_off_segments WHERE status = 'PENDING' AND endMs IS NOT NULL ORDER BY startMs ASC LIMIT :limit",
  )
  suspend fun getPending(limit: Int): List<GpsOffSegmentEntity>

  @Query("UPDATE gps_off_segments SET status = 'SENT' WHERE id IN (:ids)")
  suspend fun markSent(ids: List<Long>)

  @Query("DELETE FROM gps_off_segments WHERE status = 'SENT' AND createdAtMs < :beforeMs")
  suspend fun deleteSentBefore(beforeMs: Long): Int
}
