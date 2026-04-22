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
  @POST("/auth/login")
  suspend fun login(@Body body: LoginRequest): LoginResponse

  @GET("/auth/me")
  suspend fun me(): UserDto

  @POST("/tracking/locations/batch")
  suspend fun sendLocations(@Body body: BatchLocationRequest): BatchLocationResponse

  @Multipart
  @POST("/fuel-reports")
  suspend fun createFuelReport(
    @Part("amount") amount: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part vehiclePhoto: MultipartBody.Part?,
    @Part receiptPhoto: MultipartBody.Part?,
  ): Any

  @Multipart
  @POST("/daily-km-reports/start")
  suspend fun submitDailyKmStart(
    @Part("reportDate") reportDate: RequestBody,
    @Part("startKm") startKm: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part("recordedAt") recordedAt: RequestBody?,
    @Part startOdometer: MultipartBody.Part,
  ): DailyKmReportRefDto

  @Multipart
  @PATCH("/daily-km-reports/{id}/end")
  suspend fun submitDailyKmEnd(
    @Path("id") id: String,
    @Part("endKm") endKm: RequestBody,
    @Part("latitude") latitude: RequestBody?,
    @Part("longitude") longitude: RequestBody?,
    @Part("recordedAt") recordedAt: RequestBody?,
    @Part endOdometer: MultipartBody.Part,
  ): DailyKmReportRefDto

  @GET("/tasks/mine")
  suspend fun myTasks(): List<TaskDto>

  @GET("/tasks/mine/active")
  suspend fun myActiveTasks(): List<TaskDto>

  @GET("/vehicles/my")
  suspend fun myVehicle(): VehicleMyResponse

  @GET("/stats/last-days")
  suspend fun statsLastDays(@Query("days") days: Int = 3): StatsLastDaysResponse

  @Multipart
  @PATCH("/tasks/{id}/submit")
  suspend fun submitTask(
    @Path("id") id: String,
    @Part("proofText") proofText: RequestBody?,
    @Part proofPhoto: MultipartBody.Part?,
  ): TaskDto
}

