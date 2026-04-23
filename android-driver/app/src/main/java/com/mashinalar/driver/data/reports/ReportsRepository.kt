package com.mashinalar.driver.data.reports

import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.HttpErrors
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.DailyKmHistoryDto
import com.mashinalar.driver.data.network.FuelHistoryDto
import com.mashinalar.driver.data.network.filePart
import com.mashinalar.driver.data.network.textPart
import java.io.File
import java.time.Instant
import javax.inject.Inject

class ReportsRepository @Inject constructor(
  private val api: ApiService,
) {
  suspend fun myDailyKmReports(limit: Int = 31): ApiResult<List<DailyKmHistoryDto>> =
    try {
      ApiResult.Ok(api.myDailyKmReports(limit))
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  suspend fun myFuelReports(limit: Int = 50): ApiResult<List<FuelHistoryDto>> =
    try {
      ApiResult.Ok(api.myFuelReports(limit))
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  suspend fun createFuel(
    amount: String,
    latitude: String?,
    longitude: String?,
    vehiclePhoto: File?,
    receiptPhoto: File?,
  ): ApiResult<Unit> =
    try {
      api.createFuelReport(
        amount = textPart(amount),
        latitude = latitude?.let(::textPart),
        longitude = longitude?.let(::textPart),
        vehiclePhoto = vehiclePhoto?.let { filePart("vehiclePhoto", it) },
        receiptPhoto = receiptPhoto?.let { filePart("receiptPhoto", it) },
      )
      ApiResult.Ok(Unit)
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  suspend fun submitDailyKmStart(
    reportDateIso: String,
    startKm: String,
    startOdometer: File,
    latitude: String?,
    longitude: String?,
  ): ApiResult<String> =
    try {
      val ref = api.submitDailyKmStart(
        reportDate = textPart(reportDateIso),
        startKm = textPart(startKm),
        latitude = latitude?.let(::textPart),
        longitude = longitude?.let(::textPart),
        recordedAt = textPart(Instant.now().toString()),
        startOdometer = filePart("startOdometer", startOdometer),
      )
      ApiResult.Ok(ref.id)
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  suspend fun submitDailyKmEnd(
    reportId: String,
    endKm: String,
    endOdometer: File,
    latitude: String?,
    longitude: String?,
  ): ApiResult<Unit> =
    try {
      api.submitDailyKmEnd(
        id = reportId,
        endKm = textPart(endKm),
        latitude = latitude?.let(::textPart),
        longitude = longitude?.let(::textPart),
        recordedAt = textPart(Instant.now().toString()),
        endOdometer = filePart("endOdometer", endOdometer),
      )
      ApiResult.Ok(Unit)
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }
}

