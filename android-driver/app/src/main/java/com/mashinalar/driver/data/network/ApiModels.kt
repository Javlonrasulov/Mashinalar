package com.mashinalar.driver.data.network

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginRequest(
  val login: String,
  val password: String,
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
  val accessToken: String,
  val user: UserDto,
)

@JsonClass(generateAdapter = true)
data class UserDto(
  val id: String,
  val role: String,
  val login: String,
  val driver: DriverDto?,
)

@JsonClass(generateAdapter = true)
data class DriverDto(
  val id: String,
  val fullName: String,
  val phone: String?,
  val vehicleId: String?,
)

@JsonClass(generateAdapter = true)
data class BatchLocationRequest(
  val points: List<LocationPointDto>,
)

@JsonClass(generateAdapter = true)
data class LocationPointDto(
  val latitude: Double,
  val longitude: Double,
  val accuracyM: Double? = null,
  val speed: Double? = null,
  val heading: Double? = null,
  val recordedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class BatchLocationResponse(
  val inserted: Int,
)

@JsonClass(generateAdapter = true)
data class TaskDto(
  val id: String,
  val title: String,
  val deadlineAt: String,
  val status: String,
  val proofText: String? = null,
  val proofPhotoUrl: String? = null,
  val submittedAt: String? = null,
  val reviewedAt: String? = null,
  val vehicle: VehicleDto? = null,
)

@JsonClass(generateAdapter = true)
data class VehicleDto(
  val id: String,
  val name: String,
  val plateNumber: String,
  val model: String? = null,
)

@JsonClass(generateAdapter = true)
data class VehicleMyResponse(
  val vehicle: VehicleDto?,
  val oil: OilInfoDto?,
  val insurance: InsuranceInfoDto?,
)

@JsonClass(generateAdapter = true)
data class OilInfoDto(
  val lastOilChangeKm: Double?,
  val lastOilChangeAt: String?,
  val oilChangeIntervalKm: Int?,
  val nextOilChangeKm: Double?,
)

@JsonClass(generateAdapter = true)
data class InsuranceInfoDto(
  val insuranceStartDate: String?,
  val insuranceEndDate: String?,
  val daysToEnd: Int?,
  val warnWithinDays: Int,
  val isWarn: Boolean,
)

@JsonClass(generateAdapter = true)
data class StatsLastDaysResponse(
  val vehicleId: String,
  val days: Int,
  val range: StatsRangeDto,
  val perDay: List<StatsDayDto>,
  val totalLastDays: Double,
  val todayKm: Double,
)

@JsonClass(generateAdapter = true)
data class StatsRangeDto(
  val from: String,
  val to: String,
)

@JsonClass(generateAdapter = true)
data class StatsDayDto(
  val date: String,
  val km: Double,
)

/** Kunlik KM POST /start javobi — faqat id kerak (keyingi PATCH uchun). */
@JsonClass(generateAdapter = true)
data class DailyKmReportRefDto(
  val id: String,
)

@JsonClass(generateAdapter = true)
data class DailyKmHistoryDto(
  val id: String,
  val reportDate: String,
  val startKm: String,
  val endKm: String? = null,
  val startRecordedAt: String? = null,
  val endRecordedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class FuelHistoryDto(
  val id: String,
  val amount: String,
  val createdAt: String,
  val vehiclePhotoUrl: String? = null,
  val receiptPhotoUrl: String? = null,
)


