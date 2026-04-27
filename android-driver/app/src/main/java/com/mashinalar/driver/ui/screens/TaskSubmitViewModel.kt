package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.tasks.TasksRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import android.content.Context
import com.mashinalar.driver.R
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class TaskSubmitUiState(
  val proofText: String = "",
  val proofPhoto: File? = null,
  val loading: Boolean = false,
  val message: String? = null,
  /** Vazifa holati tekshirilmoqda. */
  val gateLoading: Boolean = true,
  /** PENDING / REJECTED — form; SUBMITTED / APPROVED yoki xato — yopilgan. */
  val allowEdit: Boolean = false,
  val gateMessage: String? = null,
  val readOnlyReason: String? = null,
)

@HiltViewModel
class TaskSubmitViewModel @Inject constructor(
  private val repo: TasksRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val _state = MutableStateFlow(TaskSubmitUiState())
  val state: StateFlow<TaskSubmitUiState> = _state

  fun setProofText(v: String) { _state.value = _state.value.copy(proofText = v, message = null) }
  fun setProofPhoto(f: File) { _state.value = _state.value.copy(proofPhoto = f, message = null) }

  fun clearProofPhoto() {
    val s = _state.value
    runCatching { s.proofPhoto?.delete() }
    _state.value = s.copy(proofPhoto = null, message = null)
  }

  fun clearMessage() {
    _state.value = _state.value.copy(message = null)
  }

  /**
   * Vazifa `taskId` bo‘yicha serverdan tekshiriladi: yuborilgan/tasdiqlangan bo‘lsa
   * [TaskSubmitUiState.allowEdit] `false`, shuningdek [readOnlyReason] beriladi.
   */
  fun prepareForTask(taskId: String) {
    viewModelScope.launch {
      _state.value =
        TaskSubmitUiState(
          proofText = "",
          proofPhoto = null,
          loading = false,
          message = null,
          gateLoading = true,
          allowEdit = false,
          gateMessage = null,
          readOnlyReason = null,
        )
      when (val r = repo.myTasks()) {
        is ApiResult.Ok -> {
          val t = r.value.firstOrNull { it.id == taskId }
          if (t == null) {
            _state.value =
              _state.value.copy(
                gateLoading = false,
                allowEdit = false,
                gateMessage = context.getString(R.string.task_not_found),
              )
            return@launch
          }
          when (t.status.uppercase()) {
            "SUBMITTED", "APPROVED" ->
              _state.value =
                _state.value.copy(
                  gateLoading = false,
                  allowEdit = false,
                  readOnlyReason = context.getString(R.string.task_submit_readonly),
                )
            else ->
              _state.value =
                _state.value.copy(
                  gateLoading = false,
                  allowEdit = true,
                )
          }
        }
        is ApiResult.Err ->
          _state.value =
            _state.value.copy(
              gateLoading = false,
              allowEdit = false,
              gateMessage = r.message,
            )
      }
    }
  }

  fun submit(taskId: String) {
    val s = _state.value
    if (!s.allowEdit || s.gateLoading) return
    if (s.proofPhoto == null && s.proofText.isBlank()) {
      _state.value = s.copy(message = context.getString(R.string.msg_task_submit_needs_proof))
      return
    }
    viewModelScope.launch {
      _state.value = s.copy(loading = true, message = null)
      val r = repo.submitTask(
        id = taskId,
        proofText = s.proofText.takeIf { it.isNotBlank() },
        proofPhoto = s.proofPhoto,
      )
      _state.value = when (r) {
        is ApiResult.Ok -> {
          runCatching { s.proofPhoto?.delete() }
          s.copy(
            loading = false,
            proofText = "",
            proofPhoto = null,
            message = context.getString(R.string.msg_sent),
            gateLoading = false,
            allowEdit = false,
            readOnlyReason = context.getString(R.string.task_submit_readonly),
          )
        }
        is ApiResult.Err -> s.copy(loading = false, message = localizeTaskSubmitError(r.message))
      }
    }
  }

  /** OkHttp/Retrofit texnik inglizcha matnlarini foydalanuvchi tilidagi xabarga almashtirish. */
  private fun localizeTaskSubmitError(raw: String): String {
    val t = raw.trim()
    if (
      t.contains("multipart", ignoreCase = true) &&
        (t.contains("at least one part", ignoreCase = true) || t.contains("must have", ignoreCase = true))
    ) {
      return context.getString(R.string.msg_task_submit_needs_proof)
    }
    return t
  }
}

