package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.ServerErrorMapper
import com.mashinalar.driver.data.network.DailyKmHistoryDto
import com.mashinalar.driver.data.reports.ReportsRepository
import com.mashinalar.driver.ui.util.LocationHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.time.LocalDate
import android.content.Context
import com.mashinalar.driver.R
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DailyKmUiState(
  val reportDate: LocalDate = LocalDate.now(),
  /** Mashina `initialKm` — server va ilovada minimal odometr */
  val minOdometerKm: Double? = null,
  val startKm: String = "",
  val endKm: String = "",
  val startPhoto: File? = null,
  val endPhoto: File? = null,
  /** 1-bosqich serverga yuborilgach: faqat yakuniy KM / end rasm */
  val endSectionVisible: Boolean = false,
  val reportId: String? = null,
  val loading: Boolean = false,
  val message: String? = null,
  val historyItems: List<DailyKmHistoryDto> = emptyList(),
  val historyLoading: Boolean = false,
  val historyError: String? = null,
)

@HiltViewModel
class DailyKmViewModel @Inject constructor(
  private val repo: ReportsRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(DailyKmUiState())
  val state: StateFlow<DailyKmUiState> = _state

  init {
    loadHistory()
  }

  fun loadHistory() {
    viewModelScope.launch {
      val cur = _state.value
      _state.value = cur.copy(historyLoading = true, historyError = null)
      val (hr, vr) = coroutineScope {
        val h = async { repo.myDailyKmReports(40) }
        val v = async { repo.myVehicle() }
        Pair(h.await(), v.await())
      }
      val minKm = (vr as? ApiResult.Ok)?.value?.vehicle?.initialKm
      when (hr) {
        is ApiResult.Ok ->
          _state.value = _state.value.copy(
            historyLoading = false,
            historyItems = hr.value,
            historyError = null,
            minOdometerKm = minKm,
          )
        is ApiResult.Err ->
          _state.value = _state.value.copy(
            historyLoading = false,
            historyError = ServerErrorMapper.localize(context, hr.message),
            minOdometerKm = minKm,
          )
      }
    }
  }

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

  fun clearMessage() {
    _state.value = _state.value.copy(message = null)
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
      else -> {
        val startVal = s.startKm.trim().replace(',', '.').toDoubleOrNull()
        if (startVal == null) {
          _state.value = s.copy(message = context.getString(R.string.msg_daily_km_invalid_number))
          return
        }
        val floorStart = minAllowedStartKm(s.minOdometerKm, s.historyItems, s.reportDate)
        if (floorStart != null && startVal < floorStart) {
          _state.value =
            s.copy(message = context.getString(R.string.msg_daily_km_start_below_floor, floorStart))
          return
        }
        viewModelScope.launch {
          _state.value = s.copy(loading = true, message = null)
          val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
          val photo = s.startPhoto!!
          when (
            val r = repo.submitDailyKmStart(
              reportDateIso = s.reportDate.toString(),
              startKm = s.startKm.trim(),
              startOdometer = photo,
              latitude = loc?.first?.toString(),
              longitude = loc?.second?.toString(),
            )
          ) {
            is ApiResult.Ok -> {
              runCatching { photo.delete() }
              _state.value = s.copy(
                loading = false,
                endSectionVisible = true,
                reportId = r.value,
                startPhoto = null,
                message = context.getString(R.string.msg_daily_km_start_submitted),
              )
              loadHistory()
            }
            is ApiResult.Err ->
              _state.value =
                s.copy(loading = false, message = ServerErrorMapper.localize(context, r.message))
          }
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
    val endVal = s.endKm.trim().replace(',', '.').toDoubleOrNull()
    if (endVal == null) {
      _state.value = s.copy(message = context.getString(R.string.msg_daily_km_invalid_number))
      return
    }
    val startVal = s.startKm.trim().replace(',', '.').toDoubleOrNull()
    val minEnd = listOfNotNull(s.minOdometerKm, startVal).maxOrNull()
    if (minEnd != null && endVal < minEnd) {
      if (startVal != null && endVal < startVal) {
        _state.value = s.copy(message = context.getString(R.string.msg_daily_km_end_below_start))
      } else {
        _state.value =
          s.copy(message = context.getString(R.string.msg_daily_km_end_below_floor, minEnd))
      }
      return
    }
    viewModelScope.launch {
      _state.value = s.copy(loading = true, message = null)
      val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
      val photo = s.endPhoto!!
      when (val r = repo.submitDailyKmEnd(
        reportId = s.reportId,
        endKm = s.endKm.trim(),
        endOdometer = photo,
        latitude = loc?.first?.toString(),
        longitude = loc?.second?.toString(),
      )) {
        is ApiResult.Ok -> {
          runCatching { photo.delete() }
          _state.value = DailyKmUiState(message = context.getString(R.string.msg_sent))
          loadHistory()
        }
        is ApiResult.Err ->
          _state.value = s.copy(loading = false, message = ServerErrorMapper.localize(context, r.message))
      }
    }
  }
}

/**
 * `reportDate` dan oldin bo‘lgan tarix qatorlaridan **eng so‘nggi sana**dagi yozuvning
 * yakuniy KM (bo‘lmasa boshlanish) — zanjir bo‘yicha minimal boshlash.
 */
private fun lastReferenceReadingBeforeDate(
  history: List<DailyKmHistoryDto>,
  reportDate: LocalDate,
): Double? {
  var bestDay: LocalDate? = null
  var bestReading: Double? = null
  for (item in history) {
    val day =
      runCatching { LocalDate.parse(item.reportDate.trim().take(10)) }.getOrNull() ?: continue
    if (!day.isBefore(reportDate)) continue
    val eRaw = item.endKm?.trim()?.replace(',', '.') ?: ""
    val reading =
      if (eRaw.isNotEmpty()) {
        eRaw.toDoubleOrNull()
      } else {
        item.startKm.trim().replace(',', '.').toDoubleOrNull()
      } ?: continue
    if (bestDay == null || day.isAfter(bestDay)) {
      bestDay = day
      bestReading = reading
    }
  }
  return bestReading
}

/** Boshlash KM: mashina `initialKm` va zanjir bo‘yicha oldingi kun yozuvi. */
private fun minAllowedStartKm(
  initial: Double?,
  history: List<DailyKmHistoryDto>,
  reportDate: LocalDate,
): Double? {
  val chain = lastReferenceReadingBeforeDate(history, reportDate)
  return when {
    initial != null && chain != null -> kotlin.math.max(initial, chain)
    initial != null -> initial
    else -> chain
  }
}
