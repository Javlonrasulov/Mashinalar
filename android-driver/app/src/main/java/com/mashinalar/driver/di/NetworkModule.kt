package com.mashinalar.driver.di

import com.mashinalar.driver.BuildConfig
import com.mashinalar.driver.core.DeviceInfo
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.AuthInterceptor
import com.mashinalar.driver.data.network.UnauthorizedInterceptor
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
  private fun baseUrl(): String =
    if (DeviceInfo.isEmulator()) BuildConfig.EMULATOR_BASE_URL else BuildConfig.DEVICE_BASE_URL

  @Provides
  @Singleton
  fun moshi(): Moshi = Moshi.Builder()
    .add(KotlinJsonAdapterFactory())
    .build()

  @Provides
  @Singleton
  fun okHttp(auth: AuthInterceptor, unauthorized: UnauthorizedInterceptor): OkHttpClient {
    val log = HttpLoggingInterceptor().apply {
      level = if (BuildConfig.HTTP_LOG_BODY) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.BASIC
    }
    return OkHttpClient.Builder()
      .addInterceptor(auth)
      .addInterceptor(unauthorized)
      .addInterceptor(log)
      .connectTimeout(30, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .build()
  }

  @Provides
  @Singleton
  fun retrofit(moshi: Moshi, okHttp: OkHttpClient): Retrofit =
    Retrofit.Builder()
      .baseUrl(baseUrl())
      .client(okHttp)
      .addConverterFactory(MoshiConverterFactory.create(moshi))
      .build()

  @Provides
  @Singleton
  fun api(retrofit: Retrofit): ApiService = retrofit.create(ApiService::class.java)
}

