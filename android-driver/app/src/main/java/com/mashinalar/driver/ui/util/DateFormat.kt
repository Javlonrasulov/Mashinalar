package com.mashinalar.driver.ui.util

import com.mashinalar.driver.util.AppZone
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val DMY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")
private val DMY_HM: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")

/** "2026-05-06" or full ISO datetime → "06-05-2026" (O‘zbekiston vaqti). */
fun formatIsoToDmy(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  val t = iso.trim()
  return runCatching {
    // Fast-path for date-only (or prefix)
    val datePart = if (t.length >= 10) t.take(10) else t
    val d = LocalDate.parse(datePart)
    DMY.format(d)
  }.getOrElse {
    runCatching {
      val i = Instant.parse(t)
      DMY.withZone(AppZone.zone).format(i)
    }.getOrElse { "—" }
  }
}

/** ISO instant → "06-05-2026 08:50" (O‘zbekiston vaqti). */
fun formatIsoToDmyHm(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  return runCatching {
    val i = Instant.parse(iso.trim())
    DMY_HM.withZone(AppZone.zone).format(i)
  }.getOrElse { "—" }
}

