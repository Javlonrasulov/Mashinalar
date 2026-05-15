package com.mashinalar.driver.util

import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/** Business timezone: O‘zbekiston (Toshkent), telefon sozlamasidan mustaqil. */
object AppZone {
  val zone: ZoneId = ZoneId.of("Asia/Tashkent")

  fun now(): ZonedDateTime = ZonedDateTime.now(zone)

  fun today(): LocalDate = LocalDate.now(zone)
}
