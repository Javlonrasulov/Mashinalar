package com.mashinalar.driver.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mashinalar.driver.core.ApiResult
import com.mashinalar.driver.data.network.TaskDto
import com.mashinalar.driver.data.tasks.TasksRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class TasksUiState(
  val loading: Boolean = false,
  val error: String? = null,
  val tasks: List<TaskDto> = emptyList(),
)

@HiltViewModel
class TasksViewModel @Inject constructor(
  private val repo: TasksRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(TasksUiState())
  val state: StateFlow<TasksUiState> = _state

  fun refresh() {
    viewModelScope.launch {
      _state.value = _state.value.copy(loading = true, error = null)
      _state.value = when (val r = repo.myTasks()) {
        is ApiResult.Ok -> TasksUiState(tasks = r.value)
        is ApiResult.Err -> TasksUiState(error = r.message)
      }
    }
  }
}

