package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DoneAll
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.NotificationEntity
import uz.fvvgis.app.ui.components.EmptyPanel
import uz.fvvgis.app.ui.viewmodel.MainUiState

@Composable
fun NotificationsScreen(
    state: MainUiState,
    notifications: List<NotificationEntity>,
    onMarkRead: (String) -> Unit,
    onMarkAllRead: () -> Unit,
    onOpenAuth: () -> Unit
) {
    val locale = state.locale
    if (state.account == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Button(onClick = onOpenAuth) { Text(L10n.text(locale, "login")) }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = L10n.text(locale, "notifications"),
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black),
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onMarkAllRead) {
                Icon(Icons.Outlined.DoneAll, contentDescription = "Mark all read")
            }
        }

        if (notifications.isEmpty()) {
            EmptyPanel(locale = locale, icon = Icons.Outlined.NotificationsNone)
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(notifications, key = { it.id }) { item ->
                    val unread = item.readAt == null
                    ElevatedCard(
                        onClick = { if (unread) onMarkRead(item.id) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(
                                imageVector = if (unread) Icons.Outlined.NotificationsActive else Icons.Outlined.NotificationsNone,
                                contentDescription = null,
                                tint = if (unread) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(item.title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold))
                                Text(item.body, style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    text = item.createdAt,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
