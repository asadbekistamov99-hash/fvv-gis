package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.SyncOperationEntity
import uz.fvvgis.app.ui.components.DataRowView
import uz.fvvgis.app.ui.components.EmptyPanel
import uz.fvvgis.app.ui.components.SectionCard
import uz.fvvgis.app.ui.components.StatusPill
import uz.fvvgis.app.ui.viewmodel.MainUiState
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SyncScreen(
    state: MainUiState,
    queue: List<SyncOperationEntity>,
    onToggleOffline: (Boolean) -> Unit,
    onSynchronize: () -> Unit,
    onRenewLease: () -> Unit,
    onExpireLeaseForTesting: () -> Unit,
    onResolveAcceptServer: (String) -> Unit,
    onResolveRetryLocal: (String) -> Unit
) {
    val locale = state.locale
    var conflictDialogOp by remember { mutableStateOf<SyncOperationEntity?>(null) }

    val lastSyncFormatted = remember(state.lastSyncAtMs) {
        if (state.lastSyncAtMs <= 0L) null
        else SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(state.lastSyncAtMs))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = L10n.text(locale, "queue"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )

        SectionCard {
            DataRowView(
                L10n.text(locale, "networkStatusLabel"),
                L10n.text(locale, if (state.isNetworkConnected) "networkOnline" else "networkDeviceOffline")
            )
            DataRowView(L10n.text(locale, "lastSync"), lastSyncFormatted)
            if (state.isEmployee) {
                DataRowView(
                    L10n.text(locale, "permission"),
                    if (state.isLeaseValid) "${state.leaseRemainingMinutes} min" else "—"
                )
            }
            SwitchListItem(
                title = L10n.pick(locale, "Offline rejim (navbat sinovi)", "Офлайн-режим (тест очереди)", "Offline mode (queue test)"),
                checked = state.offlineMode,
                onCheckedChange = onToggleOffline
            )
        }

        if (!state.isNetworkConnected && queue.isNotEmpty()) {
            SectionCard {
                Text(
                    text = L10n.text(locale, "waitingForNetworkHint"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        Button(
            enabled = !state.syncing,
            onClick = onSynchronize,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("sync_now_button")
        ) {
            if (state.syncing) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.Outlined.Sync, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "sync"))
        }

        if (state.isEmployee) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = onRenewLease,
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text(L10n.pick(locale, "Ruxsatni yangilash", "Продлить доступ", "Renew grant"))
                }
                OutlinedButton(
                    onClick = onExpireLeaseForTesting,
                    modifier = Modifier.weight(1f).height(48.dp)
                ) {
                    Text(L10n.pick(locale, "Muddatni tugatish", "Истечение теста", "Expire grant"))
                }
            }
        }

        if (queue.isEmpty()) {
            EmptyPanel(locale = locale, icon = Icons.Outlined.CloudDone)
        } else {
            queue.forEach { op ->
                val kindKey = when (op.entityType) {
                    "emergency_incident" -> "entityEmergencyIncident"
                    "citizen_report" -> "entityCitizenReport"
                    else -> "entityInfrastructure"
                }
                SectionCard {
                    Text(
                        text = L10n.text(locale, kindKey),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = op.objectName,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Spacer(Modifier.height(6.dp))
                    StatusPill(op.status, locale)
                    DataRowView(L10n.text(locale, "updated"), op.createdAt)
                    if (op.errorMessage != null) {
                        Text(
                            text = op.errorMessage,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                    if (op.status == "conflict") {
                        OutlinedButton(
                            onClick = { conflictDialogOp = op },
                            modifier = Modifier.testTag("resolve_conflict_${op.operationId}")
                        ) {
                            Icon(Icons.Outlined.CompareArrows, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(L10n.text(locale, "review"))
                        }
                    }
                }
            }
        }
    }

    conflictDialogOp?.let { op ->
        AlertDialog(
            onDismissRequest = { conflictDialogOp = null },
            title = { Text(L10n.text(locale, "review")) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(op.errorMessage ?: "", color = MaterialTheme.colorScheme.error)
                    Text("LOCAL PAYLOAD", style = MaterialTheme.typography.labelLarge)
                    Text(op.payloadJson.take(260), style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                Button(onClick = {
                    onResolveRetryLocal(op.operationId)
                    conflictDialogOp = null
                }) { Text("${L10n.text(locale, "retry")} · LOCAL") }
            },
            dismissButton = {
                OutlinedButton(onClick = {
                    onResolveAcceptServer(op.operationId)
                    conflictDialogOp = null
                }) { Text("${L10n.text(locale, "verify")} · SERVER") }
            }
        )
    }
}

@Composable
private fun SwitchListItem(title: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f).padding(end = 12.dp))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
