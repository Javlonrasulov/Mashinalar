package com.mashinalar.driver.data.network

import android.content.Context
import com.mashinalar.driver.core.DeviceInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.Interceptor
import okhttp3.Response

@Singleton
class DeviceHeadersInterceptor @Inject constructor(
  @ApplicationContext private val context: Context,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val req = chain.request().newBuilder()
      .header("User-Agent", DeviceInfo.userAgent(context))
      .header("X-Device-Id", DeviceInfo.installationId(context))
      .header("X-Device-Label", DeviceInfo.displayName())
      .build()
    return chain.proceed(req)
  }
}
