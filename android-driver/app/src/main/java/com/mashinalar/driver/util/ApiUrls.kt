package com.mashinalar.driver.util

import com.mashinalar.driver.BuildConfig
import com.mashinalar.driver.core.DeviceInfo

fun apiBaseUrl(): String =
  if (DeviceInfo.isEmulator()) BuildConfig.EMULATOR_BASE_URL else BuildConfig.DEVICE_BASE_URL

/** Server `/uploads/...` yo‘lini to‘liq URL qiladi (Coil uchun). */
fun absoluteUploadUrl(path: String?): String? {
  if (path.isNullOrBlank()) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  val b = apiBaseUrl().trimEnd('/')
  return if (path.startsWith("/")) "$b$path" else "$b/$path"
}
