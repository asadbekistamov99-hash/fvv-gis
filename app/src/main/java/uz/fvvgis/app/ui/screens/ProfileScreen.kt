package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.ui.components.ConfirmDialog
import uz.fvvgis.app.ui.components.SectionCard
import uz.fvvgis.app.ui.viewmodel.MainUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    state: MainUiState,
    pendingSyncCount: Int = 0,
    onSetDarkTheme: (Boolean) -> Unit,
    onSetLocale: (AppLocale) -> Unit,
    onUpdateName: (String) -> Unit,
    onOpenRoutes: () -> Unit,
    onOpenSync: () -> Unit,
    onOpenAuth: () -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit
) {
    val locale = state.locale
    val account = state.account
    var showEditName by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var langExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = L10n.text(locale, "profile"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )

        SectionCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(64.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Outlined.Person,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(34.dp)
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = account?.fullName ?: L10n.text(locale, "citizen"),
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Text(account?.phone ?: "FVV GIS", style = MaterialTheme.typography.bodyMedium)
                    if (account != null) {
                        Text(
                            text = account.role,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        if (account != null) {
            OutlinedButton(
                onClick = { showEditName = true },
                modifier = Modifier.fillMaxWidth().height(50.dp).testTag("profile_edit_name_button")
            ) {
                Icon(Icons.Outlined.Edit, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, "edit"))
            }
        }

        SectionCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(Icons.Outlined.DarkMode, contentDescription = null)
                    Text(L10n.text(locale, "darkMode"), style = MaterialTheme.typography.bodyLarge)
                }
                Switch(
                    checked = state.darkTheme,
                    onCheckedChange = onSetDarkTheme,
                    modifier = Modifier.testTag("profile_dark_switch")
                )
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
            ExposedDropdownMenuBox(expanded = langExpanded, onExpandedChange = { langExpanded = !langExpanded }) {
                OutlinedTextField(
                    value = locale.displayName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(L10n.text(locale, "language")) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(langExpanded) },
                    modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth().testTag("profile_language_dropdown")
                )
                ExposedDropdownMenu(expanded = langExpanded, onDismissRequest = { langExpanded = false }) {
                    AppLocale.entries.forEach { loc ->
                        DropdownMenuItem(
                            text = { Text(loc.displayName) },
                            onClick = { onSetLocale(loc); langExpanded = false }
                        )
                    }
                }
            }
        }

        if (state.isEmployee) {
            OutlinedButton(
                onClick = onOpenRoutes,
                modifier = Modifier.fillMaxWidth().height(52.dp).testTag("profile_routes_button")
            ) {
                Icon(Icons.Outlined.Route, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, "route"))
            }
        }

        if (state.isEmployee || pendingSyncCount > 0 || state.isEffectiveOffline) {
            OutlinedButton(
                onClick = onOpenSync,
                modifier = Modifier.fillMaxWidth().height(52.dp).testTag("profile_sync_button")
            ) {
                Icon(Icons.Outlined.Sync, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(
                    if (pendingSyncCount > 0) "${L10n.text(locale, "queue")} ($pendingSyncCount)"
                    else L10n.text(locale, "queue")
                )
            }
        }

        if (account == null) {
            Button(
                onClick = onOpenAuth,
                modifier = Modifier.fillMaxWidth().height(54.dp).testTag("profile_login_button")
            ) {
                Text(L10n.text(locale, "login"))
            }
        } else {
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth().height(52.dp).testTag("profile_logout_button")
            ) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, "logout"))
            }
            TextButton(
                onClick = { showDeleteConfirm = true },
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Icon(Icons.Outlined.PersonRemove, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text(L10n.text(locale, "deleteAccount"))
            }
        }

        Spacer(Modifier.height(8.dp))
        Text(
            text = L10n.text(locale, "independent"),
            style = MaterialTheme.typography.labelLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth()
        )
    }

    if (showEditName && account != null) {
        var nameInput by remember { mutableStateOf(account.fullName) }
        AlertDialog(
            onDismissRequest = { showEditName = false },
            title = { Text(L10n.text(locale, "name")) },
            text = {
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(onClick = {
                    if (nameInput.trim().length >= 2) {
                        onUpdateName(nameInput)
                        showEditName = false
                    }
                }) { Text(L10n.text(locale, "save")) }
            },
            dismissButton = {
                TextButton(onClick = { showEditName = false }) { Text(L10n.text(locale, "cancel")) }
            }
        )
    }

    if (showDeleteConfirm) {
        ConfirmDialog(
            title = L10n.text(locale, "deleteConfirm"),
            locale = locale,
            onConfirm = {
                showDeleteConfirm = false
                onDeleteAccount()
            },
            onDismiss = { showDeleteConfirm = false }
        )
    }
}
