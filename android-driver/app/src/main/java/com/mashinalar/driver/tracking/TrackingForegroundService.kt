package com.mashinalar.driver.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.mashinalar.driver.R
import com.mashinalar.driver.data.db.GpsOffSegmentDao
import com.mashinalar.driver.data.db.GpsOffSegmentEntity
import com.mashinalar.driver.data.db.LocationPointDao
import com.mashinalar.driver.data.db.LocationPointEntity
import com.mashinalar.driver.notifications.AlertNotifier
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

@AndroidEntryPoint
class TrackingForegroundService : Service() {
  @Inject lateinit var dao: LocationPointDao
  @Inject lateinit var gpsDao: GpsOffSegmentDao

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val channelId = "tracking"
  private val client by lazy { LocationServices.getFusedLocationProviderClient(this) }
  private var callback: LocationCallback? = null
  private var lastGpsOn: Boolean? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
    AlertNotifier.ensureChannels(this)
    val notification = buildNotification()
    val fgsType =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      } else {
        0
      }
    ServiceCompat.startForeground(this, 1001, notification, fgsType)
    startUpdates()
    startBackgroundLoop()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onDestroy() {
    stopUpdates()
    runBlocking(Dispatchers.IO) {
      runCatching {
        if (gpsDao.getOpen() != null) {
          gpsDao.closeAllOpen(System.currentTimeMillis())
        }
      }
    }
    UploadScheduler.enqueueNow(this)
    scope.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    val ch = NotificationChannel(channelId, "GPS Tracking", NotificationManager.IMPORTANCE_LOW)
    nm.createNotificationChannel(ch)
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle(getString(R.string.app_name))
      .setContentText(getString(R.string.tracking_notif_text))
      .setOngoing(true)
      .build()

  @android.annotation.SuppressLint("MissingPermission")
  private fun startUpdates() {
    if (callback != null) return
    val req = LocationRequest.Builder(
      com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
      15_000L, // 10-30s requirement → default 15s
    )
      .setMinUpdateIntervalMillis(10_000L)
      .setWaitForAccurateLocation(false)
      .build()

    val cb = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        val loc = result.lastLocation ?: return
        scope.launch {
          val now = System.currentTimeMillis()
          dao.insert(
            LocationPointEntity(
              latitude = loc.latitude,
              longitude = loc.longitude,
              accuracyM = if (loc.hasAccuracy()) loc.accuracy.toDouble() else null,
              speed = if (loc.hasSpeed()) loc.speed.toDouble() else null,
              heading = if (loc.hasBearing()) loc.bearing.toDouble() else null,
              recordedAtMs = loc.time.takeIf { it > 0 } ?: now,
              status = "PENDING",
              createdAtMs = now,
            ),
          )

          if (Connectivity.isOnline(this@TrackingForegroundService)) {
            UploadScheduler.enqueueNow(this@TrackingForegroundService)
          }
        }
      }
    }
    callback = cb
    client.requestLocationUpdates(req, cb, Looper.getMainLooper())
  }

  private fun stopUpdates() {
    val cb = callback ?: return
    callback = null
    runCatching { client.removeLocationUpdates(cb) }
  }

  private fun startBackgroundLoop() {
    scope.launch {
      runGpsStartupCleanup()
      while (isActive) {
        recordGpsTransitions()
        val gpsOn = Gps.isEnabled(this@TrackingForegroundService)
        val online = Connectivity.isOnline(this@TrackingForegroundService)

        if (!gpsOn) AlertNotifier.showGpsOff(this@TrackingForegroundService) else AlertNotifier.hideGpsOff(this@TrackingForegroundService)
        if (!online) AlertNotifier.showInternetOff(this@TrackingForegroundService) else AlertNotifier.hideInternetOff(this@TrackingForegroundService)

        // 5 s — qisqa GPS o‘chiq/yoniq oralig‘i 20 s tsiklda yo‘qolib qolmasin.
        delay(5_000L)
      }
    }
  }

  private suspend fun runGpsStartupCleanup() {
    if (Gps.isEnabled(this@TrackingForegroundService)) {
      gpsDao.deleteAllOpen()
    }
    lastGpsOn = Gps.isEnabled(this@TrackingForegroundService)
  }

  private suspend fun recordGpsTransitions() {
    val on = Gps.isEnabled(this@TrackingForegroundService)
    val prev = lastGpsOn
    val now = System.currentTimeMillis()
    when {
      prev == true && !on -> {
        if (gpsDao.getOpen() == null) {
          gpsDao.insert(
            GpsOffSegmentEntity(
              startMs = now,
              endMs = null,
              status = "OPEN",
              createdAtMs = now,
            ),
          )
          if (Connectivity.isOnline(this@TrackingForegroundService)) {
            UploadScheduler.enqueueNow(this@TrackingForegroundService)
          }
        }
      }
      prev == false && on -> {
        val closed = gpsDao.closeAllOpen(now) > 0
        if (closed && Connectivity.isOnline(this@TrackingForegroundService)) {
          UploadScheduler.enqueueNow(this@TrackingForegroundService)
        }
      }
      prev == null && !on -> {
        if (gpsDao.getOpen() == null) {
          gpsDao.insert(
            GpsOffSegmentEntity(
              startMs = now,
              endMs = null,
              status = "OPEN",
              createdAtMs = now,
            ),
          )
        }
      }
    }
    lastGpsOn = on
  }
}
