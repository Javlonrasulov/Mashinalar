package com.mashinalar.driver.ui.scaffold

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.mashinalar.driver.R
import com.mashinalar.driver.ui.scaffold.NavItem.Home
import com.mashinalar.driver.ui.scaffold.NavItem.Fuel
import com.mashinalar.driver.ui.scaffold.NavItem.DailyKm
import com.mashinalar.driver.ui.scaffold.NavItem.Tasks
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LocalGasStation
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Task
import androidx.compose.material.icons.filled.Home

enum class NavItem(val route: String, val labelRes: Int) {
  Home("home", R.string.nav_home),
  Fuel("fuel", R.string.nav_fuel),
  DailyKm("daily_km", R.string.nav_daily_km),
  Tasks("tasks", R.string.nav_tasks),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScaffold(
  navController: NavHostController,
  title: String,
  showBottomBar: Boolean,
  onLanguageClick: () -> Unit,
  onProfileClick: () -> Unit,
  content: @Composable (PaddingValues, SnackbarHostState) -> Unit,
) {
  val snackbarHostState = remember { SnackbarHostState() }
  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(title) },
        actions = {
          IconButton(onClick = onLanguageClick) { Icon(Icons.Default.Language, contentDescription = null) }
          IconButton(onClick = onProfileClick) { Icon(Icons.Default.AccountCircle, contentDescription = null) }
        },
        colors = TopAppBarDefaults.topAppBarColors(),
      )
    },
    bottomBar = {
      if (showBottomBar) {
        val items = listOf(Home, Fuel, DailyKm, Tasks)
        val entry = navController.currentBackStackEntryAsState().value
        val route = entry?.destination?.route
        NavigationBar {
          items.forEach { item ->
            NavigationBarItem(
              selected = route == item.route,
              onClick = {
                navController.navigate(item.route) {
                  popUpTo(navController.graph.startDestinationId) { saveState = true }
                  launchSingleTop = true
                  restoreState = true
                }
              },
              icon = {
                when (item) {
                  Home -> Icon(Icons.Filled.Home, contentDescription = null)
                  Fuel -> Icon(Icons.Filled.LocalGasStation, contentDescription = null)
                  DailyKm -> Icon(Icons.Filled.Route, contentDescription = null)
                  Tasks -> Icon(Icons.Filled.Task, contentDescription = null)
                }
              },
              label = { Text(stringResource(item.labelRes)) },
            )
          }
        }
      }
    },
    snackbarHost = { SnackbarHost(snackbarHostState) },
  ) { pv ->
    content(pv, snackbarHostState)
  }
}

