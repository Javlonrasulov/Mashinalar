package com.mashinalar.driver.data.network

import com.mashinalar.driver.data.auth.TokenStore
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor @Inject constructor(
  private val tokenStore: TokenStore,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val token = runBlocking { tokenStore.tokenFlow.first() }
    val req = if (!token.isNullOrBlank()) {
      chain.request().newBuilder()
        .header("Authorization", "Bearer $token")
        .build()
    } else {
      chain.request()
    }
    return chain.proceed(req)
  }
}

