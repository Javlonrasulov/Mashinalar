package com.mashinalar.driver.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.mashinalar.driver.R
import com.mashinalar.driver.ui.scaffold.AppScaffold
import com.mashinalar.driver.ui.scaffold.NavItem
import com.mashinalar.driver.ui.scaffold.LanguageDialog
import com.mashinalar.driver.ui.screens.DailyKmScreen
import com.mashinalar.driver.ui.screens.FuelScreen
import com.mashinalar.driver.ui.screens.HomeScreen
import com.mashinalar.driver.ui.screens.LoginScreen
import com.mashinalar.driver.ui.screens.TaskSubmitScreen
import com.mashinalar.driver.ui.screens.TasksScreen

private object Routes {
  const val Login = "login"
  const val TaskSubmit = "task_submit"
}

@Composable
fun AppNav(
  state: RootState,
  onLogin: (String, String) -> Unit,
  onLogout: () -> Unit,
  onSetLanguageTag: (String) -> Unit,
  navController: NavHostController = rememberNavController(),
) {
  if (!state.hasToken) {
    LoginScreen(
      loading = state.loginLoading,
      error = state.loginError,
      onLogin = onLogin,
    )
    return
  }

  val navBackStackEntry by navController.currentBackStackEntryAsState()
  val route = navBackStackEntry?.destination?.route
  val title = when (route) {
    NavItem.Home.route -> stringResource(R.string.home_title)
    NavItem.Fuel.route -> stringResource(R.string.fuel_title)
    NavItem.DailyKm.route -> stringResource(R.string.daily_km_title)
    NavItem.Tasks.route -> stringResource(R.string.tasks_title)
    else -> stringResource(R.string.app_name)
  }
  val mainTabRoutes = setOf(
    NavItem.Home.route,
    NavItem.Fuel.route,
    NavItem.DailyKm.route,
    NavItem.Tasks.route,
  )
  // Birinchi frame'da route hali null bo‘lishi mumkin — bottom bar yo‘qolib qolmasin.
  val showBottom = route == null || route in mainTabRoutes

  var langOpen by remember { mutableStateOf(false) }

  AppScaffold(
    navController = navController,
    title = title,
    showBottomBar = showBottom,
    onLanguageClick = { langOpen = true },
    onProfileClick = onLogout,
  ) { pv, snackbar ->
    Box(
      modifier = Modifier
        .padding(pv)
        .fillMaxSize(),
    ) {
      NavHost(
        modifier = Modifier.fillMaxSize(),
        navController = navController,
        startDestination = NavItem.Home.route,
      ) {
        composable(NavItem.Home.route) {
          HomeScreen()
        }
        composable(NavItem.Fuel.route) { FuelScreen(snackbarHost = snackbar) }
        composable(NavItem.DailyKm.route) {
          DailyKmScreen(snackbarHost = snackbar, modifier = Modifier.fillMaxSize())
        }
        composable(NavItem.Tasks.route) {
          TasksScreen(
            onSubmit = { taskId -> navController.navigate("${Routes.TaskSubmit}/$taskId") },
            snackbarHost = snackbar,
          )
        }
        composable("${Routes.TaskSubmit}/{id}") { entry ->
          val id = entry.arguments?.getString("id").orEmpty()
          TaskSubmitScreen(taskId = id, onDone = { navController.popBackStack() }, snackbarHost = snackbar)
        }
      }

      if (langOpen) {
        LanguageDialog(
          selectedTag = state.languageTag,
          onDismiss = { langOpen = false },
          onSelect = { tag ->
            langOpen = false
            onSetLanguageTag(tag)
          },
        )
      }
    }
  }

  LaunchedEffect(state.hasToken) {
    if (!state.hasToken && navController.currentDestination?.route != Routes.Login) {
      navController.navigate(Routes.Login) { popUpTo(0) }
    }
  }
}

