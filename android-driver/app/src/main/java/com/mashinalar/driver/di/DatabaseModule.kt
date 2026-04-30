package com.mashinalar.driver.di

import android.content.Context
import androidx.room.Room
import com.mashinalar.driver.data.db.AppDatabase
import com.mashinalar.driver.data.db.GpsOffSegmentDao
import com.mashinalar.driver.data.db.LocationPointDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
  @Provides
  @Singleton
  fun db(@ApplicationContext context: Context): AppDatabase =
    Room.databaseBuilder(context, AppDatabase::class.java, "mashinalar-driver.db")
      .fallbackToDestructiveMigration()
      .build()

  @Provides
  fun locationDao(db: AppDatabase): LocationPointDao = db.locationPointDao()

  @Provides
  fun gpsOffSegmentDao(db: AppDatabase): GpsOffSegmentDao = db.gpsOffSegmentDao()
}

