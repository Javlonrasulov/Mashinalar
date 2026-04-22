package com.mashinalar.driver.tracking

import android.content.Context
import android.location.LocationManager

object Gps {
  fun isEnabled(context: Context): Boolean {
    val lm = context.getSystemService(LocationManager::class.java)
    return runCatching {
      lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }.getOrDefault(false)
  }
}

