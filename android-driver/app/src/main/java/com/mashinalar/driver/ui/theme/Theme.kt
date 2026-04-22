package com.mashinalar.driver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape

private val Light = lightColorScheme(
  primary = Indigo,
  onPrimary = androidx.compose.ui.graphics.Color.White,
  secondary = IndigoDark,
  onSecondary = androidx.compose.ui.graphics.Color.White,
  background = Slate50,
  onBackground = Slate900,
  surface = androidx.compose.ui.graphics.Color.White,
  onSurface = Slate900,
)

private val Dark = darkColorScheme(
  primary = Indigo,
  onPrimary = androidx.compose.ui.graphics.Color.White,
  secondary = IndigoDark,
  onSecondary = androidx.compose.ui.graphics.Color.White,
)

private val AppShapes = Shapes(
  extraSmall = RoundedCornerShape(10.dp),
  small = RoundedCornerShape(12.dp),
  medium = RoundedCornerShape(14.dp),
  large = RoundedCornerShape(16.dp),
  extraLarge = RoundedCornerShape(20.dp),
)

@Composable
fun MashinalarTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = if (darkTheme) Dark else Light,
    shapes = AppShapes,
    content = content,
  )
}

