package com.mashinalar.driver.core

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object NetworkErrors {
  private const val DEFAULT_MSG = "Serverga ulanib bo‘lmadi. Internet yoki BASE_URL ni tekshiring"
  private const val TIMEOUT_MSG =
    "Server javob bermadi (timeout). Kompyuter IPsi to‘g‘rimi? (local.properties → MASHINALAR_DEVICE_BASE_URL), " +
      "api ishlayaptimi (npm run start:dev), Windows firewall 3000-portni oching, telefon bilan bir xil Wi‑Fi."

  fun toUserMessage(t: Throwable): String {
    return when (t) {
      is UnknownHostException -> DEFAULT_MSG
      is SocketTimeoutException -> TIMEOUT_MSG
      is IOException -> DEFAULT_MSG
      else -> t.message ?: DEFAULT_MSG
    }
  }
}

