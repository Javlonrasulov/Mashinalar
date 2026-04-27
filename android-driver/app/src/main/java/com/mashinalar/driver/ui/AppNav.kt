package com.mashinalar.driver.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
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
import com.mashinalar.driver.ui.screens.OilScreen
import com.mashinalar.driver.ui.screens.ProfileScreen
import com.mashinalar.driver.ui.screens.TaskSubmitScreen
import com.mashinalar.driver.ui.screens.TaskBellViewModel
import com.mashinalar.driver.ui.screens.TasksScreen

private object Routes {
  const val Login = "login"
  const val TaskSubmit = "task_submit"
  const val Profile = "profile"
}

@Composable
fun AppNav(
  state: RootState,
  onLogin: (String, String) -> Unit,
  onLogout: () -> Unit,
  onSetLanguageTag: (String) -> Unit,
  navController: NavHostController = rememberNavController(),
) {
  val taskBellVm: TaskBellViewModel = hiltViewModel()
  val navBackStackEntry by navController.currentBackStackEntryAsState()
  LaunchedEffect(state.hasToken, navBackStackEntry?.destination?.route) {
    if (state.hasToken) taskBellVm.refresh()
    else taskBellVm.clear()
  }

  if (!state.hasToken) {
    LoginScreen(
      loading = state.loginLoading,
      error = state.loginError,
      onLogin = onLogin,
    )
    return
  }

  val route = navBackStackEntry?.destination?.route
  val bellTasks by taskBellVm.tasks.collectAsState()
  var taskBellMenuExpanded by remember { mutableStateOf(false) }
  val title = when (route) {
    NavItem.Home.route -> stringResource(R.string.home_title)
    NavItem.Fuel.route -> stringResource(R.string.fuel_title)
    NavItem.DailyKm.route -> stringResource(R.string.daily_km_title)
    NavItem.Tasks.route -> stringResource(R.string.tasks_title)
    NavItem.Oil.route -> stringResource(R.string.oil_title)
    Routes.Profile -> stringResource(R.string.profile_title)
    else -> stringResource(R.string.app_name)
  }
  val mainTabRoutes = setOf(
    NavItem.Home.route,
    NavItem.Fuel.route,
    NavItem.DailyKm.route,
    NavItem.Tasks.route,
    NavItem.Oil.route,
  )
  // Birinchi frame'da route hali null bo‘lishi mumkin — bottom bar yo‘qolib qolmasin.
  val showBottom = route == null || route in mainTabRoutes

  LaunchedEffect(route) { taskBellMenuExpanded = false }

  var langOpen by remember { mutableStateOf(false) }

  AppScaffold(
    navController = navController,
    title = title,
    showBottomBar = showBottom,
    onLanguageClick = { langOpen = true },
    onProfileClick = {
      navController.navigate(Routes.Profile) {
        launchSingleTop = true
      }
    },
    onBackClick =
      if (route == Routes.Profile) {
        { navController.popBackStack() }
      } else {
        null
      },
    showProfileAction = route != Routes.Profile,
    showTaskBell = true,
    taskBellCount = bellTasks.size,
    taskBellTasks = bellTasks,
    taskBellMenuExpanded = taskBellMenuExpanded,
    onTaskBellClick = { taskBellMenuExpanded = !taskBellMenuExpanded },
    onDismissTaskBellMenu = { taskBellMenuExpanded = false },
    onTaskBellItemClick = { taskId ->
      taskBellMenuExpanded = false
      navController.navigate("${Routes.TaskSubmit}/$taskId")
    },
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
        composable(NavItem.Oil.route) {
          OilScreen(snackbarHost = snackbar)
        }
        composable("${Routes.TaskSubmit}/{id}") { entry ->
          val id = entry.arguments?.getString("id").orEmpty()
          TaskSubmitScreen(taskId = id, onDone = { navController.popBackStack() }, snackbarHost = snackbar)
        }
        composable(Routes.Profile) {
          ProfileScreen(snackbarHost = snackbar, onLogout = onLogout)
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

