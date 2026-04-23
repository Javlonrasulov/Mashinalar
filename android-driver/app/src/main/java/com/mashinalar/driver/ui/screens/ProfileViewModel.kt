package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
  val loading: Boolean = true,
  val error: String? = null,
  val login: String = "",
  val fullName: String? = null,
  val passwordSubmitting: Boolean = false,
  val passwordError: String? = null,
  val passwordSuccess: Boolean = false,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
  private val auth: AuthRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(ProfileUiState())
  val state: StateFlow<ProfileUiState> = _state.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      _state.value = ProfileUiState(loading = true)
      when (val r = auth.me()) {
        is ApiResult.Ok -> {
          val u = r.value
          _state.value =
            ProfileUiState(
              loading = false,
              login = u.login,
              fullName = u.driver?.fullName,
            )
        }
        is ApiResult.Err -> _state.value = ProfileUiState(loading = false, error = r.message)
      }
    }
  }

  fun clearPasswordError() {
    _state.update { it.copy(passwordError = null) }
  }

  fun consumePasswordSuccess() {
    _state.update { it.copy(passwordSuccess = false) }
  }

  fun changePassword(currentPassword: String, newPassword: String) {
    viewModelScope.launch {
      _state.update {
        it.copy(passwordSubmitting = true, passwordError = null, passwordSuccess = false)
      }
      when (val r = auth.updateCredentials(currentPassword, newPassword)) {
        is ApiResult.Ok ->
          _state.update { it.copy(passwordSubmitting = false, passwordSuccess = true) }
        is ApiResult.Err ->
          _state.update { it.copy(passwordSubmitting = false, passwordError = r.message) }
      }
    }
  }
}
