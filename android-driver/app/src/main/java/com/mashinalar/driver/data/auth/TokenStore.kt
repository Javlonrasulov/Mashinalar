package com.mashinalar.driver.data.auth

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "auth")

class TokenStore @Inject constructor(
  @ApplicationContext private val context: Context,
) {
  private val key: Preferences.Key<String> = stringPreferencesKey("accessToken")

  val tokenFlow: Flow<String?> = context.dataStore.data.map { prefs -> prefs[key] }

  suspend fun setToken(token: String) {
    context.dataStore.edit { prefs -> prefs[key] = token }
  }

  suspend fun clear() {
    context.dataStore.edit { prefs ->
      prefs.remove(key)
    }
  }
}

