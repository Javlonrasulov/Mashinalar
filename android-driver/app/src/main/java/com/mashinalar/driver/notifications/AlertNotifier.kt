package com.mashinalar.driver.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.mashinalar.driver.ui.MainActivity
import com.mashinalar.driver.R

object AlertNotifier {
  private const val CHANNEL_ID = "alerts"
  private const val ID_GPS = 2001
  private const val ID_NET = 2002
  private const val ID_OIL_SOON = 2003
  private const val ID_OIL_OVERDUE = 2004
  private const val ID_DAILYKM_START = 2005
  private const val ID_DAILYKM_END = 2006
  private const val ID_TASKS_NEW = 2007

  private const val EXTRA_OPEN_ROUTE = "open_route"
  private const val ROUTE_DAILY_KM = "daily_km"
  private const val ROUTE_TASKS = "tasks"

  private fun dailyKmContentIntent(context: Context): PendingIntent {
    val i =
      Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        .putExtra(EXTRA_OPEN_ROUTE, ROUTE_DAILY_KM)
    val flags =
      PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getActivity(context, 0, i, flags)
  }

  private fun tasksContentIntent(context: Context): PendingIntent {
    val i =
      Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        .putExtra(EXTRA_OPEN_ROUTE, ROUTE_TASKS)
    val flags =
      PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getActivity(context, 1, i, flags)
  }

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

  fun showDailyKmStart(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_edit)
        .setContentTitle(context.getString(R.string.daily_km_notif_start_title))
        .setContentText(context.getString(R.string.daily_km_notif_start_body))
        .setContentIntent(dailyKmContentIntent(context))
        .setAutoCancel(true)
        .build()
    nm.notify(ID_DAILYKM_START, n)
  }

  fun showDailyKmEnd(context: Context) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val n =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_edit)
        .setContentTitle(context.getString(R.string.daily_km_notif_end_title))
        .setContentText(context.getString(R.string.daily_km_notif_end_body))
        .setContentIntent(dailyKmContentIntent(context))
        .setAutoCancel(true)
        .build()
    nm.notify(ID_DAILYKM_END, n)
  }

  fun showNewTasks(context: Context, count: Int) {
    ensureChannels(context)
    val nm = context.getSystemService(NotificationManager::class.java)
    val body =
      if (count == 1) {
        context.getString(R.string.task_notif_new_one)
      } else {
        context.getString(R.string.task_notif_new_many, count)
      }
    val n =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_notify_more)
        .setContentTitle(context.getString(R.string.task_notif_new_title))
        .setContentText(body)
        .setContentIntent(tasksContentIntent(context))
        .setAutoCancel(true)
        .build()
    nm.notify(ID_TASKS_NEW, n)
  }
}

