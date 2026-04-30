package com.mashinalar.driver.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
  tableName = "gps_off_segments",
  indices = [
    Index(value = ["status"]),
    Index(value = ["startMs"]),
  ],
)
data class GpsOffSegmentEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  val startMs: Long,
  /** GPS qayta yoqilguncha `null` (status OPEN). */
  val endMs: Long?,
  /** OPEN — hali ochildi; PENDING — yuborish kutilmoqda; SENT — serverga ketgan. */
  val status: String,
  val createdAtMs: Long,
)
