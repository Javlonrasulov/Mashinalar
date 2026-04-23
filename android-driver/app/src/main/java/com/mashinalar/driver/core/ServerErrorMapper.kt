package com.mashinalar.driver.core

import android.content.Context
import com.mashinalar.driver.R

/**
 * API `message` — barqaror kalit `daily_km.*` yoki `kalit|son` (masalan `daily_km.start_below_max|3455`).
 * BOM / JSON ichida qolgan holatlar ham qayta ishlanadi.
 */
object ServerErrorMapper {
  private val dailyKmToken =
    Regex("""(daily_km\.[a-zA-Z0-9_]+)(\|([^"\s}\],]+))?""")

  fun localize(context: Context, raw: String): String {
    val cleaned = raw.trim { it <= ' ' || it == '\uFEFF' || it == '\u2028' || it == '\u2029' }
    if (cleaned.isEmpty()) return raw

    dailyKmToken.find(cleaned)?.let { m ->
      val key = m.groupValues[1]
      val arg = m.groupValues.getOrNull(3)?.takeIf { it.isNotBlank() }
      return mapDailyKm(context, key, arg)
    }

    // Eski server (lotincha uz)
    if (cleaned.contains("Bu kun uchun hisobot allaqachon yopilgan")) {
      return context.getString(R.string.err_daily_km_report_day_closed)
    }
    if (cleaned.contains("Boshlash KM avvalgi yozuvlardagi eng yuqori KM")) {
      return context.getString(R.string.err_daily_km_start_below_max_legacy)
    }
    if (cleaned.contains("Yakuniy KM kamida") && cleaned.contains("boshlash KM va avvalgi")) {
      return context.getString(R.string.err_daily_km_end_below_min_legacy)
    }
    if (cleaned == "Report not found") return context.getString(R.string.err_daily_km_not_found)
    if (cleaned == "Not your report") return context.getString(R.string.err_daily_km_forbidden_not_owner)
    if (cleaned == "End already submitted for this report") {
      return context.getString(R.string.err_daily_km_end_already_submitted)
    }

    return raw
  }

  private fun mapDailyKm(context: Context, key: String, arg: String?): String {
    val num1 = arg?.replace(',', '.')?.toDoubleOrNull()
    return when (key) {
      "daily_km.no_driver" -> context.getString(R.string.err_daily_km_no_driver)
      "daily_km.report_date_required" -> context.getString(R.string.err_daily_km_report_date_required)
      "daily_km.invalid_start_km_number" -> context.getString(R.string.err_daily_km_invalid_start_km_number)
      "daily_km.invalid_end_km_number" -> context.getString(R.string.err_daily_km_invalid_end_km_number)
      "daily_km.no_vehicle" -> context.getString(R.string.err_daily_km_no_vehicle)
      "daily_km.invalid_vehicle_baseline" -> context.getString(R.string.err_daily_km_invalid_vehicle_baseline)
      "daily_km.start_below_initial" ->
        if (num1 != null) context.getString(R.string.err_daily_km_start_below_initial, num1) else key
      "daily_km.start_odo_required" -> context.getString(R.string.err_daily_km_start_odo_required)
      "daily_km.invalid_report_date" -> context.getString(R.string.err_daily_km_invalid_report_date)
      "daily_km.invalid_recorded_at_start" -> context.getString(R.string.err_daily_km_invalid_recorded_at_start)
      "daily_km.start_below_max" ->
        if (num1 != null) context.getString(R.string.err_daily_km_start_below_max, num1) else key
      "daily_km.report_day_closed" -> context.getString(R.string.err_daily_km_report_day_closed)
      "daily_km.not_found" -> context.getString(R.string.err_daily_km_not_found)
      "daily_km.forbidden_not_owner" -> context.getString(R.string.err_daily_km_forbidden_not_owner)
      "daily_km.end_already_submitted" -> context.getString(R.string.err_daily_km_end_already_submitted)
      "daily_km.end_below_min" ->
        if (num1 != null) context.getString(R.string.err_daily_km_end_below_min, num1) else key
      "daily_km.end_odo_required" -> context.getString(R.string.err_daily_km_end_odo_required)
      "daily_km.invalid_recorded_at_end" -> context.getString(R.string.err_daily_km_invalid_recorded_at_end)
      else -> key
    }
  }
}

