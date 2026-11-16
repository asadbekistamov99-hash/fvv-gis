package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.CategoryEntity
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.ui.components.EmptyPanel
import uz.fvvgis.app.ui.components.StatusPill
import uz.fvvgis.app.ui.components.SyntheticBadge
import uz.fvvgis.app.ui.viewmodel.MainUiState

@Composable
fun RegistryScreen(
    state: MainUiState,
    objects: List<InfrastructureObjectEntity>,
    categories: List<CategoryEntity>,
    onOpenPassport: (String) -> Unit,
    onOpenAuth: () -> Unit
) {
    val locale = state.locale
    if (!state.isEmployee) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Button(onClick = onOpenAuth, modifier = Modifier.testTag("registry_login_button")) {
                Text(L10n.text(locale, "login"))
            }
        }
        return
    }

    var search by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("") }
    var lifecycleFilter by remember { mutableStateOf("") }

    val filtered = remember(objects, search, statusFilter, lifecycleFilter) {
        val q = search.trim().lowercase()
        objects.filter { obj ->
            (statusFilter.isEmpty() || obj.operationalStatus == statusFilter) &&
                (lifecycleFilter.isEmpty() || obj.lifecycle == lifecycleFilter) &&
                (q.isEmpty() || "${obj.name} ${obj.code}".lowercase().contains(q))
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = L10n.text(locale, "registry"),
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black),
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = "${filtered.size}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text(L10n.text(locale, "search"), maxLines = 1) },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("registry_search_input")
            )
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("", "working", "faulty", "under_maintenance", "unknown").forEach { s ->
                    FilterChip(
                        selected = statusFilter == s && lifecycleFilter.isEmpty(),
                        onClick = {
                            statusFilter = s
                            lifecycleFilter = ""
                        },
                        label = { Text(L10n.text(locale, if (s.isEmpty()) "all" else s)) }
                    )
                }
                if (state.account?.canReviewOrPublish == true) {
                    FilterChip(
                        selected = lifecycleFilter == "submitted",
                        onClick = {
                            lifecycleFilter = if (lifecycleFilter == "submitted") "" else "submitted"
                            statusFilter = ""
                        },
                        label = { Text(L10n.text(locale, "submitted")) }
                    )
                }
            }
        }

        if (filtered.isEmpty()) {
            EmptyPanel(locale = locale)
        } else {
            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filtered, key = { it.id }) { item ->
                    val cat = categories.firstOrNull { it.id == item.categoryId }
                    ElevatedCard(
                        onClick = { onOpenPassport(item.id) },
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("registry_item_${item.id}")
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.primaryContainer,
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = when {
                                                item.categoryId.contains("hydrant") -> Icons.Outlined.LocalFireDepartment
                                                item.categoryId.contains("water") || item.categoryId.contains("reservoir") -> Icons.Outlined.WaterDrop
                                                item.categoryId.contains("gas") -> Icons.Outlined.PropaneTank
                                                item.categoryId.contains("electr") || item.categoryId.contains("substation") -> Icons.Outlined.Bolt
                                                else -> Icons.Outlined.LocationOn
                                            },
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${item.code}${cat?.let { " · ${it.localizedName(locale.code)}" } ?: ""}",
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Text(
                                        text = item.name,
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold)
                                    )
                                }
                                Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                            }
                            Spacer(Modifier.height(12.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                StatusPill(item.operationalStatus, locale)
                                StatusPill(item.lifecycle, locale)
                            }
                            if (item.isSynthetic) {
                                Spacer(Modifier.height(8.dp))
                                SyntheticBadge(locale)
                            }
                        }
                    }
                }
            }
        }
    }
}
