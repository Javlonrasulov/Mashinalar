package com.mashinalar.driver.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.mashinalar.driver.data.local.LanguageStore
import com.mashinalar.driver.tracking.TrackingForegroundService
import com.mashinalar.driver.ui.components.GpsRequiredGate
import com.mashinalar.driver.ui.theme.MashinalarTheme
import com.mashinalar.driver.util.LocaleManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
  @Inject lateinit var languageStore: LanguageStore

  /** Must be a Compose snapshot state so LaunchedEffect restarts when permission result arrives. */
  private val locationPermissionOk = mutableStateOf(false)

  private fun refreshLocationPermission() {
    val fine =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarse =
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    locationPermissionOk.value = fine || coarse
  }

  private val requestLocation = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions(),
  ) { grants ->
    locationPermissionOk.value =
      grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
        grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Hilt injects @Inject fields during super.onCreate — do not touch languageStore before this.
    super.onCreate(savedInstanceState)
    refreshLocationPermission()
    runBlocking {
      LocaleManager.applyLanguageTag(languageStore.languageTagFlow.first())
    }

    lifecycleScope.launch {
      languageStore.languageTagFlow.collectLatest { tag ->
        LocaleManager.applyLanguageTag(tag)
      }
    }

    setContent {
      val vm: RootViewModel = hiltViewModel()
      val state by vm.state.collectAsState()
      val locOk by locationPermissionOk

      MashinalarTheme {
        GpsRequiredGate {
          Surface(modifier = Modifier.fillMaxSize()) {
            AppNav(
              state = state,
              onLogin = vm::login,
              onLogout = vm::logout,
              onSetLanguageTag = vm::setLanguageTag,
            )
          }
        }
      }

      LaunchedEffect(Unit) {
        requestLocation.launch(
          arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
          ),
        )
      }

      // Lokatsiya fonida: kirilgan sessiya + ruxsat bo‘lsa avtomatik FGS (foydalanuvchidan so‘ralmaydi).
      LaunchedEffect(state.hasToken, locOk) {
        if (state.hasToken && locOk) {
          startForegroundService(Intent(this@MainActivity, TrackingForegroundService::class.java))
        } else {
          stopService(Intent(this@MainActivity, TrackingForegroundService::class.java))
        }
      }
    }
  }

  override fun onResume() {
    super.onResume()
    refreshLocationPermission()
  }
}

