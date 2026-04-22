package com.mashinalar.driver.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.mashinalar.driver.R
import java.io.File

@Composable
fun PhotoAttachmentRow(
  title: String,
  file: File,
  onRetake: () -> Unit,
  onRemove: () -> Unit,
  modifier: Modifier = Modifier,
  retakeEnabled: Boolean = true,
) {
  OutlinedCard(
    modifier = modifier.fillMaxWidth(),
    colors = CardDefaults.outlinedCardColors(),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 8.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      AsyncImage(
        model = file,
        contentDescription = null,
        modifier = Modifier
          .size(56.dp)
          .clip(RoundedCornerShape(8.dp)),
        contentScale = ContentScale.Crop,
      )
      Spacer(Modifier.width(12.dp))
      Column(modifier = Modifier.weight(1f)) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(2.dp))
        Text(
          file.name,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      IconButton(onClick = onRetake, enabled = retakeEnabled) {
        Icon(
          Icons.Filled.Edit,
          contentDescription = stringResource(R.string.photo_edit),
        )
      }
      IconButton(onClick = onRemove) {
        Icon(
          Icons.Filled.Delete,
          contentDescription = stringResource(R.string.photo_delete),
        )
      }
    }
  }
}
