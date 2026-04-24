package com.mashinalar.driver.core

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object NetworkErrors {
  private const val DEFAULT_MSG = "Serverga ulanib bo‘lmadi. Internet yoki server manzilini tekshiring"
  private const val TIMEOUT_MSG =
    "Server javob bermadi (timeout). Internetni tekshiring yoki server vaqtincha sekin ishlayapti."

  fun toUserMessage(t: Throwable): String {
    return when (t) {
      is UnknownHostException -> DEFAULT_MSG
      is SocketTimeoutException -> TIMEOUT_MSG
      is IOException -> DEFAULT_MSG
      else -> t.message ?: DEFAULT_MSG
    }
  }
}

