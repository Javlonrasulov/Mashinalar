package com.mashinalar.driver.ui.util

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.mashinalar.driver.tracking.await

object LocationHelper {
  @SuppressLint("MissingPermission")
  suspend fun getOnce(context: Context): Pair<Double, Double>? {
    val client = LocationServices.getFusedLocationProviderClient(context)
    val loc = client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
    return loc?.let { it.latitude to it.longitude }
  }
}

