package com.mashinalar.driver.data.auth

import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.HttpErrors
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.LoginRequest
import com.mashinalar.driver.data.network.UpdateCredentialsRequest
import com.mashinalar.driver.data.network.UserDto
import javax.inject.Inject
import retrofit2.HttpException

class AuthRepository @Inject constructor(
  private val api: ApiService,
  private val tokenStore: TokenStore,
) {
  suspend fun login(login: String, password: String): ApiResult<Unit> {
    return try {
      val resp = api.login(LoginRequest(login = login, password = password))
      tokenStore.setToken(resp.accessToken)
      ApiResult.Ok(Unit)
    } catch (e: HttpException) {
      ApiResult.Err(message = HttpErrors.userMessage(e), code = e.code())
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
    } catch (e: HttpException) {
      if (e.code() == 401 || e.code() == 403) tokenStore.clear()
      ApiResult.Err(message = HttpErrors.userMessage(e), code = e.code())
    } catch (t: Throwable) {
      ApiResult.Err(message = NetworkErrors.toUserMessage(t))
    }
  }

  suspend fun me(): ApiResult<UserDto> {
    return try {
      ApiResult.Ok(api.me())
    } catch (e: HttpException) {
      if (e.code() == 401 || e.code() == 403) tokenStore.clear()
      ApiResult.Err(message = HttpErrors.userMessage(e), code = e.code())
    } catch (t: Throwable) {
      ApiResult.Err(message = NetworkErrors.toUserMessage(t))
    }
  }

  suspend fun updateCredentials(currentPassword: String, newPassword: String): ApiResult<Unit> {
    return try {
      api.updateCredentials(UpdateCredentialsRequest(currentPassword = currentPassword, newPassword = newPassword))
      ApiResult.Ok(Unit)
    } catch (e: HttpException) {
      ApiResult.Err(message = HttpErrors.userMessage(e), code = e.code())
    } catch (t: Throwable) {
      ApiResult.Err(message = NetworkErrors.toUserMessage(t))
    }
  }
}

