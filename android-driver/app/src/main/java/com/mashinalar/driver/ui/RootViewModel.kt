package com.mashinalar.driver.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.auth.AuthRepository
import com.mashinalar.driver.data.auth.TokenStore
import com.mashinalar.driver.data.local.LanguageStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

data class RootState(
  val hasToken: Boolean = false,
  val loginLoading: Boolean = false,
  val loginError: String? = null,
  val languageTag: String = "uz-Cyrl",
)

@HiltViewModel
class RootViewModel @Inject constructor(
  private val auth: AuthRepository,
  private val tokenStore: TokenStore,
  private val languageStore: LanguageStore,
) : ViewModel() {
  private val _state = MutableStateFlow(RootState())
  val state: StateFlow<RootState> = _state

  init {
    viewModelScope.launch {
      tokenStore.tokenFlow
        .combine(languageStore.languageTagFlow) { token, lang ->
          Pair(!token.isNullOrBlank(), lang)
        }
        .distinctUntilChanged()
        .collectLatest { (hasToken, lang) ->
          _state.value = _state.value.copy(hasToken = hasToken, languageTag = lang)
          if (hasToken) auth.validateToken() // if expired → token cleared by repo/interceptor
        }
    }
  }

  fun login(login: String, password: String) {
    viewModelScope.launch {
      _state.value = _state.value.copy(loginLoading = true, loginError = null)
      when (val r = auth.login(login, password)) {
        is ApiResult.Ok -> _state.value = _state.value.copy(hasToken = true, loginLoading = false)
        is ApiResult.Err -> _state.value = _state.value.copy(loginLoading = false, loginError = r.message)
      }
    }
  }

  fun logout() {
    viewModelScope.launch {
      auth.logout()
      _state.value = _state.value.copy(hasToken = false)
    }
  }

  fun setLanguageTag(tag: String) {
    viewModelScope.launch { languageStore.setLanguageTag(tag) }
  }
}

