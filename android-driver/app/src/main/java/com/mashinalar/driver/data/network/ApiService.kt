package com.mashinalar.driver.data.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
  @POST("api/auth/login")
  suspend fun login(@Body body: LoginRequest): LoginResponse

  @GET("api/auth/me")
  suspend fun me(): UserDto

  @PATCH("api/auth/credentials")
  suspend fun updateCredentials(@Body body: UpdateCredentialsRequest): UserDto

  @POST("api/tracking/locations/batch")
  suspend fun sendLocations(@Body body: BatchLocationRequest): BatchLocationResponse

  @POST("api/tracking/gps-off-segments/batch")
  suspend fun sendGpsOffSegments(@Body body: BatchGpsOffSegmentsRequest): BatchLocationResponse

  @GET("api/fuel-reports/mine")
  suspend fun myFuelReports(@Query("limit") limit: Int = 50): List<FuelHistoryDto>

  @Multipart
  @POST("api/fuel-reports")
  suspend fun createFuelReport(
    @Part("amount") amount: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part vehiclePhoto: MultipartBody.Part?,
    @Part receiptPhoto: MultipartBody.Part?,
  ): Any

  @GET("api/daily-km-reports/mine")
  suspend fun myDailyKmReports(@Query("limit") limit: Int = 31): List<DailyKmHistoryDto>

  @Multipart
  @POST("api/daily-km-reports/start")
  suspend fun submitDailyKmStart(
    @Part("reportDate") reportDate: RequestBody,
    @Part("startKm") startKm: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part("recordedAt") recordedAt: RequestBody?,
    @Part startOdometer: MultipartBody.Part,
  ): DailyKmReportRefDto

  @Multipart
  @PATCH("api/daily-km-reports/{id}/end")
  suspend fun submitDailyKmEnd(
    @Path("id") id: String,
    @Part("endKm") endKm: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part("recordedAt") recordedAt: RequestBody?,
    @Part endOdometer: MultipartBody.Part,
  ): DailyKmReportRefDto

  @GET("api/tasks/mine")
  suspend fun myTasks(): List<TaskDto>

  @GET("api/tasks/mine/active")
  suspend fun myActiveTasks(): List<TaskDto>

  @GET("api/vehicles/my")
  suspend fun myVehicle(): VehicleMyResponse

  @GET("api/oil-change-reports/mine")
  suspend fun myOilChangeReports(@Query("limit") limit: Int = 50): List<OilChangeHistoryDto>

  @Multipart
  @POST("api/oil-change-reports")
  suspend fun createOilChangeReport(
    @Part("kmAtChange") kmAtChange: RequestBody,
    @Part panelPhoto: MultipartBody.Part?,
  ): Any

  @GET("api/stats/last-days")
  suspend fun statsLastDays(@Query("days") days: Int = 3): StatsLastDaysResponse

  @Multipart
  @PATCH("api/tasks/{id}/submit")
  suspend fun submitTask(
    @Path("id") id: String,
    @Part("proofText") proofText: RequestBody?,
    @Part proofPhoto: MultipartBody.Part?,
  ): TaskDto
}

