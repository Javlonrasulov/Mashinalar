package com.mashinalar.driver.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.mashinalar.driver.R

object AlertNotifier {
  private const val CHANNEL_ID = "alerts"
  private const val ID_GPS = 2001
  private const val ID_NET = 2002
  private const val ID_OIL_SOON = 2003
  private const val ID_OIL_OVERDUE = 2004

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Alerts", NotificationManager.IMPORTANCE_HIGH),
    )
  }

  fun showGpsOff(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle(context.getString(R.string.alert_gps_off_title))
      .setContentText(context.getString(R.string.alert_gps_off_body))
      .setAutoCancel(false)
      .setOngoing(true)
      .build()
    nm.notify(ID_GPS, n)
  }

  fun hideGpsOff(context: Context) {
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.cancel(ID_GPS)
  }

  fun showInternetOff(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle(context.getString(R.string.alert_net_off_title))
      .setContentText(context.getString(R.string.alert_net_off_body))
      .setAutoCancel(false)
      .setOngoing(true)
      .build()
    nm.notify(ID_NET, n)
  }

  fun hideInternetOff(context: Context) {
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.cancel(ID_NET)
  }

  fun showOilSoon(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_warning)
      .setContentTitle(context.getString(R.string.oil_notif_soon_title))
      .setContentText(context.getString(R.string.oil_notif_soon_body))
      .setAutoCancel(true)
      .build()
    nm.notify(ID_OIL_SOON, n)
  }

  fun showOilOverdue(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle(context.getString(R.string.oil_notif_overdue_title))
      .setContentText(context.getString(R.string.oil_notif_overdue_body))
      .setAutoCancel(true)
      .build()
    nm.notify(ID_OIL_OVERDUE, n)
  }
}

