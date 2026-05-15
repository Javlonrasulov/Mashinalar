package com.mashinalar.driver.ui.screens

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.ServerErrorMapper
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

enum class FuelKindOption {
  GAS,
  PETROL,
}

data class FuelUiState(
  val fuelKind: FuelKindOption = FuelKindOption.GAS,
  val amount: String = "",
  val unitPrice: String = "",
  val defaultGasPrice: String = "",
  val defaultPetrolPrice: String = "",
  val vehiclePhoto: File? = null,
  val receiptPhoto: File? = null,
  val loading: Boolean = false,
  val message: String? = null,
  val historyItems: List<FuelHistoryDto> = emptyList(),
  val historyLoading: Boolean = false,
  val historyError: String? = null,
) {
  val previewVolume: String?
    get() {
      val a = amount.filter { it.isDigit() }.toDoubleOrNull() ?: return null
      val p = unitPrice.filter { it.isDigit() }.toDoubleOrNull() ?: return null
      if (p <= 0) return null
      val v = a / p
      if (!v.isFinite() || v <= 0) return null
      return if (fuelKind == FuelKindOption.GAS) {
        String.format("%.2f m³", v)
      } else {
        String.format("%.2f L", v)
      }
    }
}

@HiltViewModel
class FuelViewModel @Inject constructor(
  private val repo: ReportsRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(FuelUiState())
  val state: StateFlow<FuelUiState> = _state

  init {
    loadVehicleFuelPrices()
    refreshHistory()
  }

  private fun loadVehicleFuelPrices() {
    viewModelScope.launch {
      when (val r = repo.myVehicle()) {
        is ApiResult.Ok -> {
          val v = r.value.vehicle
          val gas = formatPriceNumber(v?.gasPricePerM3)
          val petrol = formatPriceNumber(v?.petrolPricePerLiter)
          val cur = _state.value
          val defaultForKind =
            when (cur.fuelKind) {
              FuelKindOption.GAS -> gas
              FuelKindOption.PETROL -> petrol
            }
          _state.value =
            cur.copy(
              defaultGasPrice = gas,
              defaultPetrolPrice = petrol,
              unitPrice = cur.unitPrice.ifBlank { defaultForKind },
            )
        }
        is ApiResult.Err -> { /* defaults stay empty */ }
      }
    }
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

  fun setFuelKind(kind: FuelKindOption) {
    val s = _state.value
    val price =
      when (kind) {
        FuelKindOption.GAS -> s.defaultGasPrice
        FuelKindOption.PETROL -> s.defaultPetrolPrice
      }
    _state.value = s.copy(fuelKind = kind, unitPrice = price, message = null)
  }

  fun setAmount(v: String) {
    _state.value = _state.value.copy(amount = filterDigitsWithSpaces(v), message = null)
  }

  fun setUnitPrice(v: String) {
    _state.value = _state.value.copy(unitPrice = filterDigitsWithSpaces(v), message = null)
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
    val unitDigits = s.unitPrice.filter { it.isDigit() }
    if (unitDigits.isEmpty()) {
      _state.value = s.copy(message = context.getString(R.string.msg_fuel_unit_price_required))
      return
    }
    if (s.vehiclePhoto == null) {
      _state.value = s.copy(message = context.getString(R.string.msg_fuel_complete_all))
      return
    }
    viewModelScope.launch {
      _state.value = s.copy(loading = true, message = null)
      val loc = runCatching { LocationHelper.getOnce(context) }.getOrNull()
      val kindApi = if (s.fuelKind == FuelKindOption.GAS) "GAS" else "PETROL"
      val r =
        repo.createFuel(
          amount = amountDigits,
          fuelKind = kindApi,
          unitPrice = unitDigits,
          latitude = loc?.first?.toString(),
          longitude = loc?.second?.toString(),
          vehiclePhoto = s.vehiclePhoto,
          receiptPhoto = s.receiptPhoto,
        )
      when (r) {
        is ApiResult.Ok -> {
          runCatching { s.vehiclePhoto?.delete() }
          runCatching { s.receiptPhoto?.delete() }
          val gas = s.defaultGasPrice
          val petrol = s.defaultPetrolPrice
          _state.value =
            FuelUiState(
              fuelKind = s.fuelKind,
              defaultGasPrice = gas,
              defaultPetrolPrice = petrol,
              unitPrice = if (s.fuelKind == FuelKindOption.GAS) gas else petrol,
              message = context.getString(R.string.msg_sent),
            )
          refreshHistory()
        }
        is ApiResult.Err ->
          _state.value =
            s.copy(loading = false, message = ServerErrorMapper.localize(context, r.message))
      }
    }
  }
}

private fun filterDigitsWithSpaces(input: String): String {
  var digitCount = 0
  val out = StringBuilder()
  var prevWasSpace = false
  for (ch in input) {
    if (ch.isDigit()) {
      if (digitCount >= 14) continue
      digitCount += 1
      out.append(ch)
      prevWasSpace = false
    } else if (ch == ' ' || ch == '\u00A0') {
      if (out.isEmpty()) continue
      if (prevWasSpace) continue
      out.append(' ')
      prevWasSpace = true
    }
  }
  return out.toString().trimEnd()
}

private fun formatPriceNumber(raw: Double?): String {
  if (raw == null || !raw.isFinite() || raw <= 0) return ""
  val n = kotlin.math.round(raw).toLong()
  return n.toString()
}
