package com.mashinalar.driver.util

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

object LocaleManager {
  fun applyLanguageTag(tag: String) {
    // Example tags:
    // - "uz" (Uzbek Latin)
    // - "uz-Cyrl" (Uzbek Cyrillic)
    // - "ru" (Russian)
    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
  }
}

