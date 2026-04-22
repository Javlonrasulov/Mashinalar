package com.mashinalar.driver.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface LocationPointDao {
  @Insert
  suspend fun insert(point: LocationPointEntity): Long

  @Query(
    "SELECT * FROM location_points WHERE status = :status ORDER BY recordedAtMs ASC LIMIT :limit",
  )
  suspend fun getByStatus(status: String, limit: Int): List<LocationPointEntity>

  @Query("UPDATE location_points SET status = :status WHERE id IN (:ids)")
  suspend fun updateStatus(ids: List<Long>, status: String)

  @Query("DELETE FROM location_points WHERE status = 'SENT' AND createdAtMs < :beforeMs")
  suspend fun deleteSentBefore(beforeMs: Long): Int

  @Transaction
  suspend fun markSent(ids: List<Long>) {
    if (ids.isEmpty()) return
    updateStatus(ids, "SENT")
  }
}

