package com.mashinalar.driver.data.auth

import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.LoginRequest
import javax.inject.Inject

class AuthRepository @Inject constructor(
  private val api: ApiService,
  private val tokenStore: TokenStore,
) {
  suspend fun login(login: String, password: String): ApiResult<Unit> {
    return try {
      val resp = api.login(LoginRequest(login = login, password = password))
      tokenStore.setToken(resp.accessToken)
      ApiResult.Ok(Unit)
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(message = e.message(), code = e.code())
    } catch (t: Throwable) {
      ApiResult.Err(message = NetworkErrors.toUserMessage(t))
    }
  }

  suspend fun logout() {
    tokenStore.clear()
  }

  suspend fun validateToken(): ApiResult<Unit> {
    return try {
      api.me()
      ApiResult.Ok(Unit)
    } catch (e: retrofit2.HttpException) {
      if (e.code() == 401 || e.code() == 403) tokenStore.clear()
      ApiResult.Err(message = e.message(), code = e.code())
    } catch (t: Throwable) {
      ApiResult.Err(message = NetworkErrors.toUserMessage(t))
    }
  }
}

