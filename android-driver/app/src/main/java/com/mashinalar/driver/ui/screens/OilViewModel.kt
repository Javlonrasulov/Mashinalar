package com.mashinalar.driver.ui.screens

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.R
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.ServerErrorMapper
import com.mashinalar.driver.data.network.OilChangeHistoryDto
import com.mashinalar.driver.data.network.VehicleMyResponse
import com.mashinalar.driver.data.reports.ReportsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OilUiState(
  val loading: Boolean = true,
  val error: String? = null,
  val summary: VehicleMyResponse? = null,
  val history: List<OilChangeHistoryDto> = emptyList(),
  val kmInput: String = "",
  val panelPhoto: File? = null,
  val submitLoading: Boolean = false,
  val message: String? = null,
)

@HiltViewModel
class OilViewModel @Inject constructor(
  private val repo: ReportsRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(OilUiState())
  val state: StateFlow<OilUiState> = _state.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      _state.update { it.copy(loading = true, error = null, message = null) }
      val v = async { repo.myVehicle() }
      val h = async { repo.myOilChangeReports(50) }
      val vr = v.await()
      val hr = h.await()
      when {
        vr is ApiResult.Err ->
          _state.value =
            OilUiState(loading = false, error = ServerErrorMapper.localize(context, vr.message))
        hr is ApiResult.Err ->
          _state.value =
            OilUiState(loading = false, error = ServerErrorMapper.localize(context, hr.message))
        vr is ApiResult.Ok && hr is ApiResult.Ok ->
          _state.update {
            OilUiState(
              loading = false,
              summary = vr.value,
              history = hr.value,
            )
          }
      }
    }
  }

  fun setKm(v: String) {
    _state.update { it.copy(kmInput = v, message = null) }
  }

  fun setPanelPhoto(f: File) {
    _state.update { it.copy(panelPhoto = f, message = null) }
  }

  fun clearPanelPhoto() {
    val s = _state.value
    runCatching { s.panelPhoto?.delete() }
    _state.update { it.copy(panelPhoto = null) }
  }

  fun clearMessage() {
    _state.update { it.copy(message = null) }
  }

  fun submit() {
    val s = _state.value
    val km = s.kmInput.trim()
    if (!km.any { it.isDigit() }) {
      _state.update { it.copy(message = context.getString(R.string.oil_err_km_required)) }
      return
    }
    val photo = s.panelPhoto
    if (photo == null) {
      _state.update { it.copy(message = context.getString(R.string.oil_err_photo_required)) }
      return
    }
    viewModelScope.launch {
      _state.update { it.copy(submitLoading = true, message = null) }
      when (val r = repo.createOilChange(km, photo)) {
        is ApiResult.Ok -> {
          runCatching { photo.delete() }
          val v2 = async { repo.myVehicle() }
          val h2 = async { repo.myOilChangeReports(50) }
          val vr2 = v2.await()
          val hr2 = h2.await()
          if (vr2 is ApiResult.Ok && hr2 is ApiResult.Ok) {
            _state.update {
              it.copy(
                submitLoading = false,
                kmInput = "",
                panelPhoto = null,
                summary = vr2.value,
                history = hr2.value,
                message = context.getString(R.string.oil_saved),
              )
            }
          } else {
            refresh()
            _state.update { it.copy(submitLoading = false, message = context.getString(R.string.oil_saved)) }
          }
        }
        is ApiResult.Err ->
          _state.update {
            it.copy(submitLoading = false, message = ServerErrorMapper.localize(context, r.message))
          }
      }
    }
  }
}
