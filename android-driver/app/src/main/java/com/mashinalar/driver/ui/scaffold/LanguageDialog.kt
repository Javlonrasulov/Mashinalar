package com.mashinalar.driver.ui.scaffold

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mashinalar.driver.R

private data class LangOption(val tag: String, val labelRes: Int)

@Composable
fun LanguageDialog(
  selectedTag: String,
  onDismiss: () -> Unit,
  onSelect: (String) -> Unit,
) {
  val options = listOf(
    LangOption("uz", R.string.lang_uz_latin),
    LangOption("uz-Cyrl", R.string.lang_uz_cyrl),
    LangOption("ru", R.string.lang_ru),
  )

  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(stringResource(R.string.language_title)) },
    confirmButton = {
      TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
    },
    text = {
      Column {
        options.forEach { o ->
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(vertical = 6.dp),
          ) {
            RadioButton(selected = selectedTag == o.tag, onClick = { onSelect(o.tag) })
            Text(
              text = stringResource(o.labelRes),
              modifier = Modifier.padding(start = 10.dp, top = 12.dp),
            )
          }
        }
      }
    },
  )
}

