package com.mashinalar.driver.tracking

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network

/**
 * Tarmoq qayta paydo bo‘lganda navbatdagi lokatsiya va GPS davrlarini darhol yuborish uchun
 * [UploadLocationsWorker] ni navbatga qo‘yadi.
 */
object NetworkUploadTrigger {
  private var registered = false

  fun register(app: Application) {
    if (registered) return
    registered = true
    val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    cm.registerDefaultNetworkCallback(
      object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          UploadScheduler.enqueueNow(app)
        }
      },
    )
  }
}
