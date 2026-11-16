package uz.fvvgis.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.*
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.ui.theme.GisColors

private fun formatDistance(meters: Double): String =
    if (meters < 1000.0) "${meters.toInt()} m" else "${"%.2f".format(meters / 1000.0)} km"

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PathfindingSheet(
    locale: AppLocale,
    originLocation: GeoPoint?,
    destinationMarker: GisRegistryItem?,
    availableMarkers: List<GisRegistryItem>,
    selectedProfile: EmergencyVehicleProfile,
    avoidFaultyHazards: Boolean,
    pathResult: EmergencyPathResult?,
    onSelectDestination: (GisRegistryItem) -> Unit,
    onSelectProfile: (EmergencyVehicleProfile) -> Unit,
    onToggleAvoidHazards: (Boolean) -> Unit,
    onRequestGpsFix: () -> Unit,
    onClearRoute: () -> Unit,
    onShowOnMap: () -> Unit,
    onDismiss: () -> Unit
) {
    var destinationDropdownOpen by remember { mutableStateOf(false) }

    val sortedMarkers = remember(availableMarkers, originLocation) {
        val ref = originLocation ?: GeoPoint(41.2995, 69.2401)
        availableMarkers.sortedBy { GeoUtils.distanceMeters(ref, it.markerCoordinate) }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("pathfinding_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AltRoute,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(10.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = L10n.text(locale, "pathfindingTitle"),
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Text(
                        text = L10n.text(locale, selectedProfile.specsKey),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Origin & Destination Selector Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.MyLocation,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(18.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = L10n.text(locale, "routeOriginGps"),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = if (originLocation != null) {
                                    "${"%.5f".format(originLocation.lat)}° N, ${"%.5f".format(originLocation.lon)}° E"
                                } else {
                                    L10n.text(locale, "emergencyGpsUnavailable")
                                },
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontFamily = if (originLocation != null) FontFamily.Monospace else FontFamily.Default,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }
                        TextButton(
                            onClick = onRequestGpsFix,
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("pathfinding_capture_gps_button")
                        ) {
                            Text(L10n.text(locale, "emergencyCaptureGps"))
                        }
                    }

                    HorizontalDivider()

                    ExposedDropdownMenuBox(
                        expanded = destinationDropdownOpen,
                        onExpandedChange = { destinationDropdownOpen = !destinationDropdownOpen }
                    ) {
                        OutlinedTextField(
                            value = destinationMarker?.let { "${it.code} · ${it.name}" }
                                ?: L10n.text(locale, "selectDestinationMarker"),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "routeDestination")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(destinationDropdownOpen) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                                .fillMaxWidth()
                                .testTag("pathfinding_destination_dropdown")
                        )
                        ExposedDropdownMenu(
                            expanded = destinationDropdownOpen,
                            onDismissRequest = { destinationDropdownOpen = false }
                        ) {
                            sortedMarkers.take(25).forEach { candidate ->
                                val distLabel = originLocation?.let {
                                    " (${formatDistance(GeoUtils.distanceMeters(it, candidate.markerCoordinate))})"
                                } ?: ""
                                DropdownMenuItem(
                                    text = {
                                        Text("${candidate.code} · ${candidate.name}$distLabel")
                                    },
                                    onClick = {
                                        onSelectDestination(candidate)
                                        destinationDropdownOpen = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Emergency Vehicle Profile Selection
            Text(
                text = L10n.text(locale, "vehicleProfile"),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                EmergencyVehicleProfile.entries.forEach { profile ->
                    val selected = profile == selectedProfile
                    val icon = when (profile) {
                        EmergencyVehicleProfile.FIRE_ENGINE -> Icons.Outlined.LocalFireDepartment
                        EmergencyVehicleProfile.RESCUE_4X4 -> Icons.Outlined.DirectionsCar
                        EmergencyVehicleProfile.AMBULANCE_HAZMAT -> Icons.Outlined.MedicalServices
                    }
                    FilterChip(
                        selected = selected,
                        onClick = { onSelectProfile(profile) },
                        leadingIcon = {
                            Icon(
                                imageVector = icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        label = {
                            Text(
                                text = L10n.text(locale, profile.labelKey),
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        modifier = Modifier.testTag("pathfinding_vehicle_${profile.id}")
                    )
                }
            }

            // Faulty Hazard Avoidance Toggle
            Surface(
                onClick = { onToggleAvoidHazards(!avoidFaultyHazards) },
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
                    .testTag("pathfinding_avoid_hazards_toggle")
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Shield,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = L10n.text(locale, "bypassFaultyHazards"),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = avoidFaultyHazards,
                        onCheckedChange = onToggleAvoidHazards
                    )
                }
            }

            // Route Calculation Summary & Turn-by-Turn Steps
            if (pathResult != null) {
                val statusColor = when (pathResult.accessibilityStatus) {
                    RouteAccessibilityStatus.FULLY_ACCESSIBLE -> GisColors.StatusWorking
                    RouteAccessibilityStatus.DETOUR_APPLIED -> MaterialTheme.colorScheme.primary
                    RouteAccessibilityStatus.ACCESSIBLE_WITH_CAUTION,
                    RouteAccessibilityStatus.RESTRICTED_LAST_MILE -> GisColors.StatusMaintenance
                }

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = statusColor.copy(alpha = 0.12f),
                    border = BorderStroke(1.2.dp, statusColor.copy(alpha = 0.7f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "${formatDistance(pathResult.totalDistanceMeters)} · ${pathResult.estimatedMinutes} ${L10n.text(locale, "etaMinutes")}",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
                                    modifier = Modifier.testTag("pathfinding_summary_metrics")
                                )
                                Text(
                                    text = "${L10n.text(locale, "roadWidthWeight")}: ${"%.1f".format(pathResult.minRoadWidthMeters)} m · ${"%.0f".format(pathResult.minWeightLimitTons)} t",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = statusColor.copy(alpha = 0.2f)
                            ) {
                                Text(
                                    text = L10n.text(locale, pathResult.accessibilityStatus.labelKey),
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }

                        if (pathResult.avoidedObstacleKeys.isNotEmpty()) {
                            HorizontalDivider(color = statusColor.copy(alpha = 0.25f))
                            Text(
                                text = L10n.text(locale, "avoidedObstacles"),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                pathResult.avoidedObstacleKeys.forEach { key ->
                                    AssistChip(
                                        onClick = {},
                                        leadingIcon = {
                                            Icon(
                                                imageVector = Icons.Outlined.Block,
                                                contentDescription = null,
                                                modifier = Modifier.size(16.dp),
                                                tint = MaterialTheme.colorScheme.error
                                            )
                                        },
                                        label = {
                                            Text(
                                                text = L10n.text(locale, key),
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                // Turn-by-Turn Accessible Segments
                Text(
                    text = L10n.text(locale, "turnByTurnSteps"),
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pathResult.steps.forEachIndexed { idx, step ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (step.cautionReasonKey != null) {
                                        MaterialTheme.colorScheme.tertiaryContainer
                                    } else {
                                        MaterialTheme.colorScheme.primaryContainer
                                    }
                                ) {
                                    Text(
                                        text = "${idx + 1}",
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp)
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${step.roadName} · ${L10n.text(locale, step.roadClass.labelKey)}",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                                    )
                                    Text(
                                        text = buildString {
                                            append("${"%.1f".format(step.widthMeters)} m · ${"%.0f".format(step.maxWeightTons)} t")
                                            if (step.cautionReasonKey != null) {
                                                append(" · ${L10n.text(locale, step.cautionReasonKey)}")
                                            }
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (step.cautionReasonKey != null) {
                                            MaterialTheme.colorScheme.tertiary
                                        } else {
                                            MaterialTheme.colorScheme.onSurfaceVariant
                                        }
                                    )
                                }
                                Text(
                                    text = formatDistance(step.distanceMeters),
                                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }

            // Bottom Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onClearRoute,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("pathfinding_clear_button")
                ) {
                    Text(L10n.text(locale, "clearRoute"))
                }
                Button(
                    onClick = onShowOnMap,
                    enabled = pathResult != null,
                    modifier = Modifier
                        .weight(1.3f)
                        .height(52.dp)
                        .testTag("pathfinding_show_on_map_button")
                ) {
                    Icon(Icons.Outlined.Map, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = L10n.text(locale, "showOnMap"),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
