package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import com.mashinalar.driver.R

@Composable
fun LoginScreen(
  loading: Boolean,
  error: String?,
  onLogin: (String, String) -> Unit,
) {
  var login by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }

  Column(modifier = Modifier.padding(16.dp)) {
    Text(text = stringResource(R.string.login_title))
    Spacer(Modifier.height(12.dp))
    OutlinedTextField(
      modifier = Modifier.fillMaxWidth(),
      value = login,
      onValueChange = { login = it },
      label = { Text(stringResource(R.string.login_field)) },
      singleLine = true,
    )
    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
      modifier = Modifier.fillMaxWidth(),
      value = password,
      onValueChange = { password = it },
      label = { Text(stringResource(R.string.password_field)) },
      singleLine = true,
    )
    if (error != null) {
      Spacer(Modifier.height(8.dp))
      Text(text = error)
    }
    Spacer(Modifier.height(12.dp))
    Button(
      modifier = Modifier.fillMaxWidth(),
      enabled = !loading,
      onClick = { onLogin(login.trim(), password) },
    ) {
      Text(if (loading) stringResource(R.string.loading) else stringResource(R.string.login_action))
    }
  }
}

