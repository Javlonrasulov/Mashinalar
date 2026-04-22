package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.StatsLastDaysResponse
import com.mashinalar.driver.data.network.TaskDto
import com.mashinalar.driver.data.network.VehicleMyResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
  val loading: Boolean = false,
  val error: String? = null,
  val vehicle: VehicleMyResponse? = null,
  val stats: StatsLastDaysResponse? = null,
  val tasks: List<TaskDto> = emptyList(),
)

@HiltViewModel
class HomeViewModel @Inject constructor(
  private val api: ApiService,
) : ViewModel() {
  private val _state = MutableStateFlow(HomeUiState())
  val state: StateFlow<HomeUiState> = _state

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      _state.value = HomeUiState(loading = true, error = null)
      val v = async {
        runCatching { api.myVehicle() }.fold(
          onSuccess = { ApiResult.Ok(it) },
          onFailure = { ApiResult.Err(NetworkErrors.toUserMessage(it)) },
        )
      }
      val s = async {
        runCatching { api.statsLastDays(3) }.fold(
          onSuccess = { ApiResult.Ok(it) },
          onFailure = { ApiResult.Err(NetworkErrors.toUserMessage(it)) },
        )
      }
      val t = async {
        runCatching { api.myActiveTasks() }.fold(
          onSuccess = { ApiResult.Ok(it) },
          onFailure = { ApiResult.Err(NetworkErrors.toUserMessage(it)) },
        )
      }

      val vr = v.await()
      val sr = s.await()
      val tr = t.await()

      val err = listOfNotNull(
        (vr as? ApiResult.Err)?.message,
        (sr as? ApiResult.Err)?.message,
        (tr as? ApiResult.Err)?.message,
      ).firstOrNull()

      _state.value = HomeUiState(
        loading = false,
        error = err,
        vehicle = (vr as? ApiResult.Ok)?.value,
        stats = (sr as? ApiResult.Ok)?.value,
        tasks = (tr as? ApiResult.Ok)?.value.orEmpty(),
      )
    }
  }
}
