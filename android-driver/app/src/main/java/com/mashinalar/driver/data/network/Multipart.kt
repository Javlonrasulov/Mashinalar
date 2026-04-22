package com.mashinalar.driver.data.network

import java.io.File
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody

fun textPart(value: String): RequestBody =
  value.toRequestBody("text/plain".toMediaType())

fun filePart(field: String, file: File): MultipartBody.Part {
  val body = file.asRequestBody("image/jpeg".toMediaType())
  return MultipartBody.Part.createFormData(field, file.name, body)
}

