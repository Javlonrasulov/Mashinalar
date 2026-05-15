package com.mashinalar.driver.data.network

import com.squareup.moshi.FromJson
import com.squareup.moshi.JsonQualifier
import com.squareup.moshi.JsonReader
import com.squareup.moshi.ToJson

/** API baʼzan `5100` yoki `"5100"` (Prisma Decimal) qaytaradi. */
@Retention(AnnotationRetention.RUNTIME)
@JsonQualifier
annotation class FlexibleDouble

class FlexibleDoubleJsonAdapter {
  @FromJson
  @FlexibleDouble
  fun fromJson(reader: JsonReader): Double? =
    when (reader.peek()) {
      JsonReader.Token.NULL -> {
        reader.nextNull<Any?>()
        null
      }
      JsonReader.Token.NUMBER -> reader.nextDouble()
      JsonReader.Token.STRING ->
        reader.nextString().trim().replace(',', '.').toDoubleOrNull()?.takeIf { it.isFinite() }
      else -> {
        reader.skipValue()
        null
      }
    }

  @ToJson
  @FlexibleDouble
  fun toJson(value: Double?): Double? = value
}
