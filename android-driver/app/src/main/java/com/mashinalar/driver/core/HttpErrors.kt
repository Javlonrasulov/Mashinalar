package com.mashinalar.driver.core

import org.json.JSONObject
import retrofit2.HttpException

object HttpErrors {
  /** NestJS: `{ "statusCode":409,"message":"...","error":"Conflict"}` — foydalanuvchiga `message`. */
  fun userMessage(e: HttpException): String {
    val body =
      try {
        e.response()?.errorBody()?.use { it.string().trim() } ?: ""
      } catch (_: Exception) {
        ""
      }
    if (body.isNotBlank()) {
      try {
        val msg = JSONObject(body).optString("message").trim()
        if (msg.isNotBlank()) return msg
      } catch (_: Exception) {
        /* not JSON */
      }
      return body
    }
    return e.message()?.trim().orEmpty().ifBlank { "HTTP ${e.code()}" }
  }
}
