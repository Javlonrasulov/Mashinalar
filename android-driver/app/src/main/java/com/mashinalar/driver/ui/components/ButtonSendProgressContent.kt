package com.mashinalar.driver.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.mashinalar.driver.R

/** «Yuborish» tugmasi: yuklanayotganda spinner va matn bir qatorda, markazda. */
@Composable
fun ButtonSendProgressContent(loading: Boolean) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.Center,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    if (loading) {
      CircularProgressIndicator(
        modifier = Modifier.size(18.dp),
        strokeWidth = 2.dp,
      )
      Spacer(Modifier.width(10.dp))
      Text(stringResource(R.string.sending))
    } else {
      Text(stringResource(R.string.send))
    }
  }
}
