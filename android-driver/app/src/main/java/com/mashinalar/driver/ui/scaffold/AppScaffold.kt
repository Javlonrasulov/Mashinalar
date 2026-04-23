package com.mashinalar.driver.ui.scaffold

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.mashinalar.driver.R
import com.mashinalar.driver.ui.scaffold.NavItem.Home
import com.mashinalar.driver.ui.scaffold.NavItem.Fuel
import com.mashinalar.driver.ui.scaffold.NavItem.DailyKm
import com.mashinalar.driver.ui.scaffold.NavItem.Tasks
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
  onBackClick: (() -> Unit)? = null,
  showProfileAction: Boolean = true,
  content: @Composable (PaddingValues, SnackbarHostState) -> Unit,
) {
  val snackbarHostState = remember { SnackbarHostState() }
  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(title) },
        navigationIcon = {
          if (onBackClick != null) {
            IconButton(onClick = onBackClick) {
              Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = stringResource(R.string.back),
              )
            }
          }
        },
        actions = {
          IconButton(onClick = onLanguageClick) { Icon(Icons.Default.Language, contentDescription = null) }
          if (showProfileAction) {
            IconButton(onClick = onProfileClick) { Icon(Icons.Default.AccountCircle, contentDescription = null) }
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(),
      )
    },
    bottomBar = {
      if (showBottomBar) {
        val items = listOf(Home, Fuel, DailyKm, Tasks)
        val entry = navController.currentBackStackEntryAsState().value
        val route = entry?.destination?.route
        // Gorizontal padding — birinchi/oxirgi tab indikatori ekran chetida kesilib qolmasin.
        NavigationBar(
          modifier =
            Modifier
              .fillMaxWidth()
              .padding(horizontal = 12.dp),
        ) {
          items.forEach { item ->
            val selected = route == item.route
            NavigationBarItem(
              selected = selected,
              onClick = {
                navController.navigate(item.route) {
                  popUpTo(navController.graph.startDestinationId) { saveState = true }
                  launchSingleTop = true
                  restoreState = true
                }
              },
              colors =
                NavigationBarItemDefaults.colors(
                  indicatorColor = Color.Transparent,
                ),
              icon = {
                Box(
                  modifier = Modifier.fillMaxWidth(),
                  contentAlignment = Alignment.Center,
                ) {
                  if (selected) {
                    Box(
                      modifier =
                        Modifier
                          .width(40.dp)
                          .height(26.dp)
                          .clip(RoundedCornerShape(13.dp))
                          .background(MaterialTheme.colorScheme.secondaryContainer),
                    )
                  }
                  when (item) {
                    Home -> Icon(Icons.Filled.Home, contentDescription = null)
                    Fuel -> Icon(Icons.Filled.LocalGasStation, contentDescription = null)
                    DailyKm -> Icon(Icons.Filled.Route, contentDescription = null)
                    Tasks -> Icon(Icons.Filled.Task, contentDescription = null)
                  }
                }
              },
              label = {
                Text(
                  text = stringResource(item.labelRes),
                  modifier = Modifier.fillMaxWidth(),
                  textAlign = TextAlign.Center,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis,
                  style = MaterialTheme.typography.labelSmall,
                )
              },
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

