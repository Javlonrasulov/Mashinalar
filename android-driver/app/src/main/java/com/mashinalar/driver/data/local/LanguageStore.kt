package com.mashinalar.driver.data.local

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

class LanguageStore @Inject constructor(
  @ApplicationContext private val context: Context,
) {
  private val key: Preferences.Key<String> = stringPreferencesKey("languageTag")

  // Default: Uzbek (Cyrillic)
  val languageTagFlow: Flow<String> = context.dataStore.data.map { prefs -> prefs[key] ?: "uz-Cyrl" }

  suspend fun setLanguageTag(tag: String) {
    context.dataStore.edit { prefs -> prefs[key] = tag }
  }
}

