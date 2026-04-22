package com.mashinalar.driver.core

sealed class ApiResult<out T> {
  data class Ok<T>(val value: T) : ApiResult<T>()
  data class Err(val message: String, val code: Int? = null) : ApiResult<Nothing>()
}

