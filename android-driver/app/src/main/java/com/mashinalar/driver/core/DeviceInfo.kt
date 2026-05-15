package com.mashinalar.driver.core

import android.content.Context
import android.os.Build
import com.mashinalar.driver.BuildConfig
import java.util.UUID

object DeviceInfo {
  private const val PREFS = "mashinalar_driver"
  private const val KEY_INSTALL_ID = "install_id"

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

  /** Ilova o‘rnatilgandan keyin o‘zgarmaydigan qurilma identifikatori. */
  fun installationId(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.getString(KEY_INSTALL_ID, null)?.let { return it }
    val id = UUID.randomUUID().toString()
    prefs.edit().putString(KEY_INSTALL_ID, id).apply()
    return id
  }

  /** Admin panelda ko‘rinadigan qisqa nom: masalan «Samsung Galaxy A12». */
  fun displayName(): String {
    val mfr = Build.MANUFACTURER.replaceFirstChar { c ->
      if (c.isLowerCase()) c.titlecase() else c.toString()
    }
    val model = Build.MODEL.trim()
    return if (model.startsWith(mfr, ignoreCase = true)) model else "$mfr $model"
  }

  /** To‘liq User-Agent (server tarix uchun). */
  fun userAgent(context: Context): String {
    val app = "Mashinalar-Driver/${BuildConfig.VERSION_NAME}"
    val device = displayName()
    val android = "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})"
    val shortId = installationId(context).take(8)
    return "$app ($device; $android; id=$shortId)"
  }
}
