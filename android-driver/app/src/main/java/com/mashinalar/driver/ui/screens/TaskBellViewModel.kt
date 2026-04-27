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
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class TaskBellViewModel @Inject constructor(
  private val repo: TasksRepository,
) : ViewModel() {
  private val _tasks = MutableStateFlow<List<TaskDto>>(emptyList())
  val tasks: StateFlow<List<TaskDto>> = _tasks.asStateFlow()

  fun refresh() {
    viewModelScope.launch {
      when (val r = repo.myActiveTasks()) {
        is ApiResult.Ok -> _tasks.value = r.value
        is ApiResult.Err -> _tasks.value = emptyList()
      }
    }
  }

  fun clear() {
    _tasks.value = emptyList()
  }
}
