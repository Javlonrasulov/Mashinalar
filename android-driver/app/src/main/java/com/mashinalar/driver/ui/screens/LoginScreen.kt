package com.mashinalar.driver.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.mashinalar.driver.R

@Composable
fun LoginScreen(
  loading: Boolean,
  error: String?,
  onLogin: (String, String) -> Unit,
) {
  var login by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var passwordVisible by remember { mutableStateOf(false) }

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .imePadding()
        .padding(horizontal = 16.dp, vertical = 24.dp),
    contentAlignment = Alignment.Center,
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
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
        enabled = !loading,
        visualTransformation =
          if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        trailingIcon = {
          IconButton(onClick = { passwordVisible = !passwordVisible }) {
            Icon(
              imageVector =
                if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
              contentDescription = null,
            )
          }
        },
      )
      if (error != null) {
        Spacer(Modifier.height(8.dp))
        Text(text = error, color = MaterialTheme.colorScheme.error)
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
}

