package com.mashinalar.driver.data.network

import com.mashinalar.driver.data.auth.TokenStore
import javax.inject.Inject
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class UnauthorizedInterceptor @Inject constructor(
  private val tokenStore: TokenStore,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val res = chain.proceed(chain.request())
    if (res.code == 401 || res.code == 403) {
      runBlocking { tokenStore.clear() }
    }
    return res
  }
}

