package com.mashinalar.driver.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
  tableName = "location_points",
  indices = [
    Index(value = ["status", "recordedAtMs"]),
  ],
)
data class LocationPointEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  val latitude: Double,
  val longitude: Double,
  val accuracyM: Double?,
  val speed: Double?,
  val heading: Double?,
  val recordedAtMs: Long,
  val status: String, // PENDING | SENT
  val createdAtMs: Long,
)

