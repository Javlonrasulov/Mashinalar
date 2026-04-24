package com.mashinalar.driver.ui.screens

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.network.FuelHistoryDto
import com.mashinalar.driver.data.reports.ReportsRepository
import com.mashinalar.driver.ui.util.LocationHelper
import com.mashinalar.driver.R
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class FuelUiState(
  val amount: String = "",
  val vehiclePhoto: File? = null,
  val receiptPhoto: File? = null,
  val loading: Boolean = false,
  val message: String? = null,
  val historyItems: List<FuelHistoryDto> = emptyList(),
  val historyLoading: Boolean = false,
  val historyError: String? = null,
)

@HiltViewModel
class FuelViewModel @Inject constructor(
  private val repo: ReportsRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(FuelUiState())
  val state: StateFlow<FuelUiState> = _state

  init {
    refreshHistory()
  }

  fun refreshHistory() {
    viewModelScope.launch {
      _state.value = _state.value.copy(historyLoading = true, historyError = null)
      when (val r = repo.myFuelReports(50)) {
        is ApiResult.Ok ->
          _state.value =
            _state.value.copy(historyLoading = false, historyItems = r.value, historyError = null)
        is ApiResult.Err ->
          _state.value =
            _state.value.copy(historyLoading = false, historyError = r.message)
      }
    }
  }

  fun setAmount(v: String) {
    val digits = v.filter { it.isDigit() }.take(14)
    _state.value = _state.value.copy(amount = formatAmountWithSpaces(digits), message = null)
  }

  fun setVehiclePhoto(f: File) {
    _state.value = _state.value.copy(vehiclePhoto = f, message = null)
  }

  fun setReceiptPhoto(f: File) {
    _state.value = _state.value.copy(receiptPhoto = f, message = null)
  }

  fun clearVehiclePhoto() {
    val s = _state.value
    runCatching { s.vehiclePhoto?.delete() }
    runCatching { s.receiptPhoto?.delete() }
    _state.value = s.copy(vehiclePhoto = null, receiptPhoto = null, message = null)
  }

  fun clearReceiptPhoto() {
    val s = _state.value
    runCatching { s.receiptPhoto?.delete() }
    _state.value = s.copy(receiptPhoto = null, message = null)
  }

  fun clearMessage() {
    _state.value = _state.value.copy(message = null)
  }

  fun submit() {
    val s = _state.value
    if (s.loading) return
    val amountDigits = s.amount.filter { it.isDigit() }
    if (amountDigits.isEmpty()) {
      _state.value = s.copy(message = context.getString(R.string.msg_enter_amount))
      return
    }
    if (s.vehiclePhoto == null || s.receiptPhoto == null) {
      _state.value = s.copy(message = context.getString(R.string.msg_fuel_complete_all))
      return
    }
    viewModelScope.launch {
      _state.value = s.copy(loading = true, message = null)
      val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
      val r = repo.createFuel(
        amount = amountDigits,
        latitude = loc?.first?.toString(),
        longitude = loc?.second?.toString(),
        vehiclePhoto = s.vehiclePhoto,
        receiptPhoto = s.receiptPhoto,
      )
      when (r) {
        is ApiResult.Ok -> {
          runCatching { s.vehiclePhoto?.delete() }
          runCatching { s.receiptPhoto?.delete() }
          _state.value =
            s.copy(
              amount = "",
              vehiclePhoto = null,
              receiptPhoto = null,
              loading = false,
              message = context.getString(R.string.msg_sent),
            )
          refreshHistory()
        }
        is ApiResult.Err -> _state.value = s.copy(loading = false, message = r.message)
      }
    }
  }
}

/** O‘ngdan 3 ta guruh: "48000" → "48 000" */
private fun formatAmountWithSpaces(digits: String): String {
  if (digits.isEmpty()) return ""
  val revChunks = digits.reversed().chunked(3)
  return revChunks.map { it.reversed() }.reversed().joinToString(" ")
}
