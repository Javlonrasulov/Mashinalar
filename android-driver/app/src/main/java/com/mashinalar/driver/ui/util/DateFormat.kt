package com.mashinalar.driver.ui.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val DMY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")
private val DMY_HM: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")

/** "2026-05-06" or full ISO datetime → "06-05-2026" (device timezone for datetime). */
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
      val z = ZoneId.systemDefault()
      DMY.withZone(z).format(i)
    }.getOrElse { "—" }
  }
}

/** ISO instant → "06-05-2026 08:50" (device timezone). */
fun formatIsoToDmyHm(iso: String?): String {
  if (iso.isNullOrBlank()) return "—"
  return runCatching {
    val i = Instant.parse(iso.trim())
    val z = ZoneId.systemDefault()
    DMY_HM.withZone(z).format(i)
  }.getOrElse { "—" }
}

