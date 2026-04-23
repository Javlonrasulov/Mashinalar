package com.mashinalar.driver.core

import org.json.JSONArray
import org.json.JSONObject
import retrofit2.HttpException

object HttpErrors {
  /** NestJS: `message` qator, qatorlar massivi yoki boshqa tip — foydalanuvchiga bir qator matn. */
  fun userMessage(e: HttpException): String {
    val body =
      try {
        e.response()?.errorBody()?.use { it.string().trim() } ?: ""
      } catch (_: Exception) {
        ""
      }
    if (body.isNotBlank()) {
      extractNestMessage(body)?.let {
        if (it.isNotBlank()) return it
      }
      return body
    }
    return e.message()?.trim().orEmpty().ifBlank { "HTTP ${e.code()}" }
  }

  private fun extractNestMessage(body: String): String? {
    return try {
      val o = JSONObject(body)
      if (!o.has("message") || o.isNull("message")) {
        null
      } else {
        when (val v = o.get("message")) {
          is String -> v.trim().ifBlank { null }
          is JSONArray -> {
            val parts = ArrayList<String>()
            for (i in 0 until v.length()) {
              when (val item = v.opt(i)) {
                is String -> if (item.isNotBlank()) parts.add(item.trim())
                else -> item?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let { parts.add(it) }
              }
            }
            parts.joinToString(" ").ifBlank { null }
          }
          else -> v.toString().trim().ifBlank { null }
        }
      }
    } catch (_: Exception) {
      null
    }
  }
}
