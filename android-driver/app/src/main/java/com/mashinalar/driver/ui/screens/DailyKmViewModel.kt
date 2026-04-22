package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.reports.ReportsRepository
import com.mashinalar.driver.ui.util.LocationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.time.LocalDate
import android.content.Context
import com.mashinalar.driver.R
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DailyKmUiState(
  val reportDate: LocalDate = LocalDate.now(),
  val startKm: String = "",
  val endKm: String = "",
  val startPhoto: File? = null,
  val endPhoto: File? = null,
  /** 1-bosqich serverga yuborilgach: faqat yakuniy KM / end rasm */
  val endSectionVisible: Boolean = false,
  val reportId: String? = null,
  val loading: Boolean = false,
  val message: String? = null,
)

@HiltViewModel
class DailyKmViewModel @Inject constructor(
  private val repo: ReportsRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(DailyKmUiState())
  val state: StateFlow<DailyKmUiState> = _state

  fun setStartKm(v: String) { _state.value = _state.value.copy(startKm = v, message = null) }

  fun setEndKm(v: String) {
    if (!_state.value.endSectionVisible) return
    _state.value = _state.value.copy(endKm = v, message = null)
  }

  fun setStartPhoto(f: File) { _state.value = _state.value.copy(startPhoto = f, message = null) }

  fun setEndPhoto(f: File) {
    if (!_state.value.endSectionVisible) return
    _state.value = _state.value.copy(endPhoto = f, message = null)
  }

  fun clearStartPhoto() {
    val s = _state.value
    if (s.endSectionVisible) return
    runCatching { s.startPhoto?.delete() }
    _state.value = s.copy(startPhoto = null, message = null)
  }

  fun clearEndPhoto() {
    val s = _state.value
    if (!s.endSectionVisible) return
    runCatching { s.endPhoto?.delete() }
    _state.value = s.copy(endPhoto = null, message = null)
  }

  /** 1-bosqich: boshlang‘ich KM + start rasm → server (lokatsiya + vaqt) */
  fun submitStart() {
    val s = _state.value
    if (s.loading) return
    when {
      s.startKm.trim().isEmpty() ->
        _state.value = s.copy(message = context.getString(R.string.msg_daily_km_start_km_required))
      s.startPhoto == null ->
        _state.value = s.copy(message = context.getString(R.string.msg_daily_km_start_photo_required))
      else -> viewModelScope.launch {
        _state.value = s.copy(loading = true, message = null)
        val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
        val photo = s.startPhoto!!
        val r = repo.submitDailyKmStart(
          reportDateIso = s.reportDate.toString(),
          startKm = s.startKm.trim(),
          startOdometer = photo,
          latitude = loc?.first?.toString(),
          longitude = loc?.second?.toString(),
        )
        _state.value = when (r) {
          is ApiResult.Ok -> {
            runCatching { photo.delete() }
            s.copy(
              loading = false,
              endSectionVisible = true,
              reportId = r.value,
              startPhoto = null,
              message = context.getString(R.string.msg_daily_km_start_submitted),
            )
          }
          is ApiResult.Err -> s.copy(loading = false, message = r.message)
        }
      }
    }
  }

  /** 2-bosqich: yakuniy KM + end rasm → server */
  fun submitEnd() {
    val s = _state.value
    if (s.loading) return
    if (!s.endSectionVisible || s.reportId == null) {
      _state.value = s.copy(message = context.getString(R.string.msg_daily_km_confirm_start_first))
      return
    }
    if (s.endKm.trim().isEmpty()) {
      _state.value = s.copy(message = context.getString(R.string.msg_daily_km_end_km_required))
      return
    }
    if (s.endPhoto == null) {
      _state.value = s.copy(message = context.getString(R.string.msg_daily_km_end_photo_required))
      return
    }
    viewModelScope.launch {
      _state.value = s.copy(loading = true, message = null)
      val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
      val photo = s.endPhoto!!
      val r = repo.submitDailyKmEnd(
        reportId = s.reportId,
        endKm = s.endKm.trim(),
        endOdometer = photo,
        latitude = loc?.first?.toString(),
        longitude = loc?.second?.toString(),
      )
      _state.value = when (r) {
        is ApiResult.Ok -> {
          runCatching { photo.delete() }
          DailyKmUiState(message = context.getString(R.string.msg_sent))
        }
        is ApiResult.Err -> s.copy(loading = false, message = r.message)
      }
    }
  }
}
