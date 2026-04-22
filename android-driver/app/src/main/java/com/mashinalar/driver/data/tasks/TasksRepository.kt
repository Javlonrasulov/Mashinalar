package com.mashinalar.driver.data.tasks

import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.core.NetworkErrors
import com.mashinalar.driver.data.network.ApiService
import com.mashinalar.driver.data.network.TaskDto
import com.mashinalar.driver.data.network.filePart
import com.mashinalar.driver.data.network.textPart
import java.io.File
import javax.inject.Inject

class TasksRepository @Inject constructor(
  private val api: ApiService,
) {
  suspend fun myTasks(): ApiResult<List<TaskDto>> =
    try {
      ApiResult.Ok(api.myTasks())
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(e.message(), e.code())
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
    } catch (e: retrofit2.HttpException) {
      ApiResult.Err(e.message(), e.code())
    } catch (t: Throwable) {
      ApiResult.Err(NetworkErrors.toUserMessage(t))
    }
}

