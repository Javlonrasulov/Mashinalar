package com.mashinalar.driver.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
  entities = [
    LocationPointEntity::class,
  ],
  version = 1,
  exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun locationPointDao(): LocationPointDao
}

