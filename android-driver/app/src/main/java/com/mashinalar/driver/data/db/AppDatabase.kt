package com.mashinalar.driver.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
  entities = [
    LocationPointEntity::class,
    GpsOffSegmentEntity::class,
  ],
  version = 2,
  exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun locationPointDao(): LocationPointDao

  abstract fun gpsOffSegmentDao(): GpsOffSegmentDao
}

