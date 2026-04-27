package com.mashinalar.driver.data.tasks

import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.HttpErrors
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.TaskDto
import com.mashinalar.driver.data.network.filePart
import com.mashinalar.driver.data.network.textPart
import java.io.File
import javax.inject.Inject
import retrofit2.HttpException

class TasksRepository @Inject constructor(
  private val api: ApiService,
) {
  suspend fun myTasks(): ApiResult<List<TaskDto>> =
    try {
      ApiResult.Ok(api.myTasks())
    } catch (e: HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  /** Haydovchi uchun bajarish kerak bo‘lgan vazifalar (server: `mine/active`). */
  suspend fun myActiveTasks(): ApiResult<List<TaskDto>> =
    try {
      ApiResult.Ok(api.myActiveTasks())
    } catch (e: HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }

  suspend fun submitTask(id: String, proofText: String?, proofPhoto: File?): ApiResult<TaskDto> =
    try {
      ApiResult.Ok(
        api.submitTask(
          id = id,
          proofText = proofText?.takeIf { it.isNotBlank() }?.let(::textPart),
          proofPhoto = proofPhoto?.let { filePart("proofPhoto", it) },
        ),
      )
    } catch (e: HttpException) {
      ApiResult.Err(HttpErrors.userMessage(e), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }
}

