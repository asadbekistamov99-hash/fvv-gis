package uz.fvvgis.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoBounds
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.core.OfflineAreaRecord
import uz.fvvgis.app.core.OfflineTileEstimator
import uz.fvvgis.app.core.TileDetailPreset
import uz.fvvgis.app.data.local.RegionEntity

enum class DownloadAreaMode {
    CURRENT_VIEW,
    REGION
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DownloadAreaSheet(
    locale: AppLocale,
    regions: List<RegionEntity>,
    currentViewport: MapViewport,
    savedAreas: List<OfflineAreaRecord>,
    creatingDownload: Boolean,
    selectedAreaMode: DownloadAreaMode,
    selectedRegionId: String?,
    selectedPreset: TileDetailPreset,
    previewBounds: GeoBounds,
    onSelectMode: (DownloadAreaMode) -> Unit,
    onSelectRegion: (String) -> Unit,
    onSelectPreset: (TileDetailPreset) -> Unit,
    onStartDownload: (areaName: String) -> Unit,
    onTogglePauseResume: (Long) -> Unit,
    onJumpToArea: (OfflineAreaRecord) -> Unit,
    onDeleteArea: (Long) -> Unit,
    onDismiss: () -> Unit
) {
    val selectedRegion = remember(regions, selectedRegionId) {
        regions.firstOrNull { it.id == selectedRegionId } ?: regions.firstOrNull()
    }
    val estimatedTiles = remember(previewBounds, selectedPreset) {
        OfflineTileEstimator.estimateTileCount(
            bounds = previewBounds,
            minZoom = selectedPreset.minZoom,
            maxZoom = selectedPreset.maxZoom
        )
    }
    val estimatedBytes = remember(estimatedTiles) {
        OfflineTileEstimator.estimateBytes(estimatedTiles)
    }
    val proposedAreaName = remember(selectedAreaMode, selectedRegion, currentViewport, locale) {
        if (selectedAreaMode == DownloadAreaMode.REGION && selectedRegion != null) {
            selectedRegion.localizedName(locale.code)
        } else {
            "${L10n.text(locale, "currentMapView")} (${"%.2f".format(currentViewport.centerLat)}°, ${"%.2f".format(currentViewport.centerLon)}°)"
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("download_area_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 640.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Icon(
                        imageVector = Icons.Outlined.DownloadForOffline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(10.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = L10n.text(locale, "downloadArea"),
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Text(
                        text = L10n.text(locale, "offlineMaps"),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("download_area_close_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = L10n.text(locale, "cancel")
                    )
                }
            }

            Text(
                text = L10n.text(locale, "offlineAreaHint"),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Area Selection Mode
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = L10n.text(locale, "areaSelectionMode"),
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    FilterChip(
                        selected = selectedAreaMode == DownloadAreaMode.CURRENT_VIEW,
                        onClick = { onSelectMode(DownloadAreaMode.CURRENT_VIEW) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Outlined.CropFree,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        label = {
                            Text(
                                text = L10n.text(locale, "currentMapView"),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                            .testTag("download_mode_current_view")
                    )
                    FilterChip(
                        selected = selectedAreaMode == DownloadAreaMode.REGION,
                        onClick = { onSelectMode(DownloadAreaMode.REGION) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Outlined.Public,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        label = {
                            Text(
                                text = L10n.text(locale, "selectUzbekistanRegion"),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                            .testTag("download_mode_region")
                    )
                }
            }

            // Region selector when REGION mode is active
            if (selectedAreaMode == DownloadAreaMode.REGION && regions.isNotEmpty()) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(regions, key = { it.id }) { region ->
                        val isSelected = selectedRegion?.id == region.id
                        FilterChip(
                            selected = isSelected,
                            onClick = { onSelectRegion(region.id) },
                            label = { Text(region.localizedName(locale.code)) },
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("download_region_chip_${region.id}")
                        )
                    }
                }
            }

            // Tile Detail Level
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = L10n.text(locale, "tileDetailLevel"),
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    TileDetailPreset.entries.forEach { preset ->
                        FilterChip(
                            selected = selectedPreset == preset,
                            onClick = { onSelectPreset(preset) },
                            label = { Text(L10n.text(locale, preset.labelKey)) },
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("download_preset_${preset.name.lowercase()}")
                        )
                    }
                }
            }

            // Bounding Box & Estimate Summary Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = proposedAreaName,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Text(
                        text = "${"%.3f".format(previewBounds.southLat)}°..${"%.3f".format(previewBounds.northLat)}° N · ${"%.3f".format(previewBounds.westLon)}°..${"%.3f".format(previewBounds.eastLon)}° E",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = L10n.text(locale, "estimatedTiles"),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "$estimatedTiles ${L10n.text(locale, "tilesLabel")}",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = L10n.text(locale, "estimatedSize"),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = OfflineTileEstimator.formatBytes(estimatedBytes),
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            // Download Action Button
            Button(
                onClick = { onStartDownload(proposedAreaName) },
                enabled = !creatingDownload,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("download_area_start_button")
            ) {
                if (creatingDownload) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = L10n.text(locale, "downloadingTiles"),
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.Download,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = L10n.text(locale, "downloadNow"),
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            HorizontalDivider()

            // Saved Offline Areas Section
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = L10n.text(locale, "savedOfflineAreas"),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    text = "${savedAreas.size}",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold),
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (savedAreas.isEmpty()) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CloudDownload,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = L10n.text(locale, "noSavedOfflineAreas"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    savedAreas.forEach { area ->
                        ElevatedCard(
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("offline_area_card_${area.id}")
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = area.name,
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = "Z${area.minZoom.toInt()}–Z${area.maxZoom.toInt()} · ${OfflineTileEstimator.formatBytes(area.completedBytes)} · ${area.completedResources}/${area.requiredResources.coerceAtLeast(area.completedResources)} ${L10n.text(locale, "tilesLabel")}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(Modifier.width(8.dp))
                                    if (area.isComplete) {
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = MaterialTheme.colorScheme.secondaryContainer
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Outlined.OfflinePin,
                                                    contentDescription = null,
                                                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                                Text(
                                                    text = L10n.text(locale, "offlineReadyBadge"),
                                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                                    color = MaterialTheme.colorScheme.onSecondaryContainer
                                                )
                                            }
                                        }
                                    } else {
                                        val pct = (area.progressFraction * 100f).toInt()
                                        Text(
                                            text = "$pct%",
                                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }

                                if (!area.isComplete || area.isActive) {
                                    LinearProgressIndicator(
                                        progress = { area.progressFraction },
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }

                                area.errorMessage?.let { err ->
                                    Text(
                                        text = err,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (!area.isComplete) {
                                        FilledTonalButton(
                                            onClick = { onTogglePauseResume(area.id) },
                                            modifier = Modifier
                                                .defaultMinSize(minHeight = 48.dp)
                                                .testTag("offline_area_toggle_${area.id}")
                                        ) {
                                            Icon(
                                                imageVector = if (area.isActive) Icons.Outlined.Pause else Icons.Outlined.PlayArrow,
                                                contentDescription = null,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Text(
                                                text = L10n.text(
                                                    locale,
                                                    if (area.isActive) "pauseDownload" else "resumeDownload"
                                                ),
                                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                                            )
                                        }
                                    }
                                    OutlinedButton(
                                        onClick = { onJumpToArea(area) },
                                        modifier = Modifier
                                            .weight(1f)
                                            .defaultMinSize(minHeight = 48.dp)
                                            .testTag("offline_area_jump_${area.id}")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.CenterFocusWeak,
                                            contentDescription = null,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            text = L10n.text(locale, "jumpToArea"),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    IconButton(
                                        onClick = { onDeleteArea(area.id) },
                                        modifier = Modifier
                                            .minimumInteractiveComponentSize()
                                            .testTag("offline_area_delete_${area.id}")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.DeleteOutline,
                                            contentDescription = L10n.text(locale, "deleteArea"),
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}
