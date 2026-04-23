package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.R

@Composable
fun ProfileScreen(
  snackbarHost: SnackbarHostState,
  onLogout: () -> Unit,
  vm: ProfileViewModel = hiltViewModel(),
) {
  val state by vm.state.collectAsState()
  var passwordDialogOpen by remember { mutableStateOf(false) }

  val pwdChanged = stringResource(R.string.profile_password_changed)

  LaunchedEffect(state.passwordSuccess) {
    if (state.passwordSuccess) {
      snackbarHost.showSnackbar(pwdChanged)
      vm.consumePasswordSuccess()
      passwordDialogOpen = false
    }
  }

  LaunchedEffect(state.passwordError) {
    val err = state.passwordError
    if (err != null) {
      snackbarHost.showSnackbar(err)
      vm.clearPasswordError()
    }
  }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 16.dp)
        .imePadding(),
  ) {
    when {
      state.loading ->
        Column(
          modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          CircularProgressIndicator()
          Spacer(Modifier.height(12.dp))
          Text(stringResource(R.string.loading), style = MaterialTheme.typography.bodyMedium)
        }
      state.error != null -> {
        Text(
          text = state.error.orEmpty(),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = { vm.refresh() }, modifier = Modifier.fillMaxWidth()) {
          Text(stringResource(R.string.refresh))
        }
      }
      else -> {
        val nameLine =
          state.fullName?.trim()?.takeIf { it.isNotEmpty() }?.let { "$it | ${state.login}" }
            ?: state.login
        Text(text = nameLine, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(24.dp))
        FilledTonalButton(
          onClick = { passwordDialogOpen = true },
          enabled = !state.passwordSubmitting,
          modifier = Modifier.fillMaxWidth(),
        ) {
          Text(stringResource(R.string.profile_change_password))
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
          Text(stringResource(R.string.logout), color = MaterialTheme.colorScheme.error)
        }
      }
    }
  }

  if (passwordDialogOpen) {
    ChangePasswordDialog(
      submitting = state.passwordSubmitting,
      onDismiss = {
        if (!state.passwordSubmitting) passwordDialogOpen = false
      },
      onSubmit = { current, new -> vm.changePassword(current, new) },
    )
  }
}

@Composable
private fun ChangePasswordDialog(
  submitting: Boolean,
  onDismiss: () -> Unit,
  onSubmit: (current: String, new: String) -> Unit,
) {
  var current by remember { mutableStateOf("") }
  var newPwd by remember { mutableStateOf("") }
  var confirm by remember { mutableStateOf("") }
  var showCurrent by remember { mutableStateOf(false) }
  var showNew by remember { mutableStateOf(false) }
  var showConfirm by remember { mutableStateOf(false) }

  fun canSave(): Boolean {
    if (current.isBlank() || newPwd.isBlank() || confirm.isBlank()) return false
    if (newPwd.length < 6) return false
    if (newPwd != confirm) return false
    return true
  }

  AlertDialog(
    onDismissRequest = { if (!submitting) onDismiss() },
    title = { Text(stringResource(R.string.profile_password_dialog_title)) },
    text = {
      Column(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
          value = current,
          onValueChange = { current = it },
          label = { Text(stringResource(R.string.password_current)) },
          singleLine = true,
          enabled = !submitting,
          visualTransformation =
            if (showCurrent) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          trailingIcon = {
            IconButton(onClick = { showCurrent = !showCurrent }) {
              Icon(
                if (showCurrent) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                contentDescription = null,
              )
            }
          },
          modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = newPwd,
          onValueChange = { newPwd = it },
          label = { Text(stringResource(R.string.password_new)) },
          singleLine = true,
          enabled = !submitting,
          supportingText = {
            if (newPwd.isNotEmpty() && newPwd.length < 6) {
              Text(stringResource(R.string.profile_password_too_short))
            }
          },
          visualTransformation =
            if (showNew) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          trailingIcon = {
            IconButton(onClick = { showNew = !showNew }) {
              Icon(
                if (showNew) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                contentDescription = null,
              )
            }
          },
          modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = confirm,
          onValueChange = { confirm = it },
          label = { Text(stringResource(R.string.password_confirm)) },
          singleLine = true,
          enabled = !submitting,
          supportingText = {
            if (confirm.isNotEmpty() && newPwd != confirm) {
              Text(stringResource(R.string.profile_password_mismatch))
            }
          },
          visualTransformation =
            if (showConfirm) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          trailingIcon = {
            IconButton(onClick = { showConfirm = !showConfirm }) {
              Icon(
                if (showConfirm) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                contentDescription = null,
              )
            }
          },
          modifier = Modifier.fillMaxWidth(),
        )
        if (submitting) {
          Spacer(Modifier.height(12.dp))
          LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
      }
    },
    confirmButton = {
      TextButton(
        onClick = { onSubmit(current.trim(), newPwd) },
        enabled = canSave() && !submitting,
      ) {
        Text(stringResource(R.string.save))
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss, enabled = !submitting) { Text(stringResource(R.string.close)) }
    },
  )
}
