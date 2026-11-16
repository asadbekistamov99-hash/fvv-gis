package uz.fvvgis.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.R
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.model.RegistryCategoryGroup

@Composable
fun MapSearchOverlay(
    locale: AppLocale,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    visibleGroups: Set<RegistryCategoryGroup>,
    groupCounts: Map<RegistryCategoryGroup, Int>,
    onToggleGroup: (RegistryCategoryGroup) -> Unit,
    onShowAllGroups: () -> Unit,
    hasActiveSheetFilters: Boolean,
    onOpenFiltersSheet: () -> Unit,
    modifier: Modifier = Modifier
) {
    val allGroupsSelected = visibleGroups.size == RegistryCategoryGroup.entries.size

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 14.dp)
            .testTag("map_search_overlay"),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 4.dp,
            shadowElevation = 4.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = { Text(L10n.text(locale, "searchByNameOrType"), maxLines = 1) },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                trailingIcon = {
                    Row {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(
                                onClick = { onSearchQueryChange("") },
                                modifier = Modifier.testTag("map_search_clear_button")
                            ) {
                                Icon(Icons.Outlined.Close, contentDescription = L10n.text(locale, "cancel"))
                            }
                        }
                        IconButton(
                            onClick = onOpenFiltersSheet,
                            modifier = Modifier.testTag("map_layers_button")
                        ) {
                            BadgedBox(
                                badge = {
                                    if (hasActiveSheetFilters) {
                                        Badge()
                                    }
                                }
                            ) {
                                Icon(Icons.Outlined.Tune, contentDescription = stringResource(R.string.content_desc_filters))
                            }
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("map_search_input")
            )
        }

        // Category filter chip group above the map to quickly toggle registry item types
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 2.dp),
            modifier = Modifier.testTag("map_category_chip_group")
        ) {
            item(key = "all_groups") {
                FilterChip(
                    selected = allGroupsSelected,
                    onClick = onShowAllGroups,
                    leadingIcon = {
                        Icon(
                            imageVector = if (allGroupsSelected) Icons.Outlined.DoneAll else Icons.Outlined.Visibility,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    label = { Text(L10n.text(locale, "all"), maxLines = 1) },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f)
                    ),
                    modifier = Modifier.testTag("map_group_chip_all")
                )
            }
            items(RegistryCategoryGroup.entries, key = { it.name }) { group ->
                val isVisible = group in visibleGroups
                val count = groupCounts[group] ?: 0
                val groupIcon = when (group) {
                    RegistryCategoryGroup.INFRASTRUCTURE -> Icons.Outlined.Apartment
                    RegistryCategoryGroup.HAZARDS -> Icons.Outlined.WarningAmber
                    RegistryCategoryGroup.EQUIPMENT -> Icons.Outlined.LocalFireDepartment
                }
                FilterChip(
                    selected = isVisible,
                    onClick = { onToggleGroup(group) },
                    leadingIcon = {
                        Icon(
                            imageVector = if (isVisible) Icons.Outlined.Check else groupIcon,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    label = {
                        Text(
                            text = "${L10n.text(locale, group.labelKey)} ($count)",
                            maxLines = 1
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f)
                    ),
                    modifier = Modifier.testTag("map_group_chip_${group.name.lowercase()}")
                )
            }
        }
    }
}
