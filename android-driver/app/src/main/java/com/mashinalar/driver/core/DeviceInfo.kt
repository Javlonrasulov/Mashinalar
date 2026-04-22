package com.mashinalar.driver.core

import android.os.Build

object DeviceInfo {
  fun isEmulator(): Boolean {
    val fp = Build.FINGERPRINT
    val model = Build.MODEL
    val brand = Build.BRAND
    val device = Build.DEVICE
    val product = Build.PRODUCT
    return fp.startsWith("generic") ||
      fp.startsWith("unknown") ||
      model.contains("google_sdk", ignoreCase = true) ||
      model.contains("Emulator", ignoreCase = true) ||
      model.contains("Android SDK built for x86", ignoreCase = true) ||
      brand.startsWith("generic") && device.startsWith("generic") ||
      product == "google_sdk"
  }
}

