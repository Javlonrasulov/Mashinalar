package com.mashinalar.driver.util

import com.mashinalar.driver.BuildConfig
import com.mashinalar.driver.core.DeviceInfo
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Server HTTP `Date` sarlavhasi — qurilma soati noto‘g‘ri bo‘lsa ham eslatmalar
 * taxminan server vaqti (internet) bo‘yicha qotadi.
 */
object NetworkTimeProvider {
  private val client by lazy {
    OkHttpClient.Builder()
      .connectTimeout(8, TimeUnit.SECONDS)
      .readTimeout(8, TimeUnit.SECONDS)
      .followRedirects(true)
      .build()
  }

  private fun healthUrl(): String {
    val base =
      (if (DeviceInfo.isEmulator()) BuildConfig.EMULATOR_BASE_URL else BuildConfig.DEVICE_BASE_URL)
        .trim()
    val root = base.trimEnd('/')
    return "$root/health"
  }

  private fun parseHttpDate(header: String): Instant? =
    runCatching {
      ZonedDateTime.parse(header.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
    }.getOrNull()

  suspend fun fetchServerInstantOrNull(): Instant? =
    withContext(Dispatchers.IO) {
      runCatching {
        val req =
          Request.Builder()
            .url(healthUrl())
            .header("User-Agent", "MashinalarDriver-NetworkTime/${BuildConfig.VERSION_NAME}")
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
          if (!resp.isSuccessful) return@use null
          val date = resp.header("Date") ?: return@use null
          parseHttpDate(date)
        }
      }.getOrNull()
    }

  /** Internet (server) vaqti yoki tarmoq yo‘q bo‘lsa qurilma. */
  suspend fun nowZonedTashkent(): ZonedDateTime {
    val instant = fetchServerInstantOrNull() ?: Instant.now()
    return instant.atZone(AppZone.zone)
  }
}
