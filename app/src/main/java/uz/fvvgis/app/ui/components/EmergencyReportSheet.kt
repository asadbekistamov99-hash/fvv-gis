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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.R
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.RegionEntity

private data class EmergencyHazardPreset(
    val id: String,
    val categoryId: String,
    val labelKey: String,
    val icon: ImageVector
)

private val emergencyHazardPresets = listOf(
    EmergencyHazardPreset("gas", "gas_pipeline", "hazardGasLeak", Icons.Outlined.LocalFireDepartment),
    EmergencyHazardPreset("elec", "substation", "hazardElectrical", Icons.Outlined.Bolt),
    EmergencyHazardPreset("water", "water_pipeline", "hazardWaterMain", Icons.Outlined.WaterDrop),
    EmergencyHazardPreset("hydrant", "fire_hydrant", "hazardHydrantFault", Icons.Outlined.FireHydrantAlt),
    EmergencyHazardPreset("general", "other", "hazardGeneral", Icons.Outlined.WarningAmber)
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EmergencyReportSheet(
    locale: AppLocale,
    pinLocation: GeoPoint,
    currentUserLocation: GeoPoint?,
    currentAccuracyM: Double?,
    regions: List<RegionEntity>,
    submitting: Boolean,
    isOffline: Boolean = false,
    onRequestCaptureGps: () -> Unit,
    onClearPin: () -> Unit,
    onSubmitIncident: (categoryId: String, hazardTitle: String, notes: String, regionId: String) -> Unit
) {
    val context = LocalContext.current
    var selectedPreset by remember { mutableStateOf(emergencyHazardPresets.first()) }
    var notes by remember { mutableStateOf("") }

    val nearestRegion = remember(pinLocation, regions) {
        regions.minByOrNull { reg ->
            GeoUtils.distanceMeters(pinLocation, GeoPoint(reg.centerLat, reg.centerLon))
        }
    }
    val resolvedRegionId = nearestRegion?.id ?: "UZ-TK"
    val resolvedRegionName = nearestRegion?.localizedName(locale.code) ?: "Tashkent"

    ModalBottomSheet(
        onDismissRequest = onClearPin,
        modifier = Modifier.testTag("emergency_report_sheet")
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
                    color = MaterialTheme.colorScheme.errorContainer
                ) {
                    Icon(
                        imageVector = Icons.Outlined.ReportProblem,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(10.dp)
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = L10n.text(locale, "emergencySheetTitle"),
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Text(
                        text = resolvedRegionName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Critical 112 non-dispatch reminder
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.65f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.45f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = L10n.text(locale, "emergencyNotice"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.weight(1f)
                    )
                    FilledTonalButton(
                        onClick = { dialPhone(context, "112") },
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                            contentColor = MaterialTheme.colorScheme.onError
                        ),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier
                            .defaultMinSize(minHeight = 48.dp)
                            .testTag("emergency_sheet_call_112")
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Call,
                            contentDescription = stringResource(R.string.content_desc_dial_112),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("112", fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (isOffline) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.78f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.tertiary),
                    modifier = Modifier.testTag("emergency_offline_queue_notice")
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.CloudUpload,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onTertiaryContainer,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = L10n.text(locale, "emergencyOfflineSheetHint"),
                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Coordinates Card: Dropped Pin + Current GPS
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
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
                            imageVector = Icons.Outlined.PushPin,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(18.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = L10n.text(locale, "emergencyPinCoordinates"),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${"%.5f".format(pinLocation.lat)}° N, ${"%.5f".format(pinLocation.lon)}° E",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                ),
                                modifier = Modifier.testTag("emergency_pin_coords_text")
                            )
                        }
                    }

                    HorizontalDivider()

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
                                text = L10n.text(locale, "emergencyCurrentGps"),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = if (currentUserLocation != null) {
                                    val accPart = currentAccuracyM?.let { " · ±${it.toInt()} m" } ?: ""
                                    "${"%.5f".format(currentUserLocation.lat)}° N, ${"%.5f".format(currentUserLocation.lon)}° E$accPart"
                                } else {
                                    L10n.text(locale, "emergencyGpsUnavailable")
                                },
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontFamily = if (currentUserLocation != null) FontFamily.Monospace else FontFamily.Default,
                                    fontWeight = if (currentUserLocation != null) FontWeight.SemiBold else FontWeight.Normal
                                ),
                                color = if (currentUserLocation != null) {
                                    MaterialTheme.colorScheme.onSurface
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        }
                        TextButton(
                            onClick = onRequestCaptureGps,
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("emergency_capture_gps_button")
                        ) {
                            Text(L10n.text(locale, "emergencyCaptureGps"))
                        }
                    }
                }
            }

            // 1-Tap Hazard Presets
            Text(
                text = L10n.text(locale, "emergencyHazardType"),
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                emergencyHazardPresets.forEach { preset ->
                    val selected = preset.id == selectedPreset.id
                    FilterChip(
                        selected = selected,
                        onClick = { selectedPreset = preset },
                        leadingIcon = {
                            Icon(
                                imageVector = preset.icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        },
                        label = {
                            Text(
                                text = L10n.text(locale, preset.labelKey),
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.errorContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onErrorContainer,
                            selectedLeadingIconColor = MaterialTheme.colorScheme.error
                        ),
                        modifier = Modifier.testTag("emergency_hazard_chip_${preset.id}")
                    )
                }
            }

            // Optional brief notes
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text(L10n.text(locale, "description")) },
                placeholder = { Text(L10n.text(locale, "emergencyNotesHint")) },
                minLines = 2,
                maxLines = 4,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("emergency_notes_input")
            )

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onClearPin,
                    enabled = !submitting,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("emergency_clear_pin_button")
                ) {
                    Text(L10n.text(locale, "emergencyClearPin"))
                }
                Button(
                    onClick = {
                        val title = L10n.text(locale, selectedPreset.labelKey)
                        onSubmitIncident(
                            selectedPreset.categoryId,
                            title,
                            notes,
                            resolvedRegionId
                        )
                    },
                    enabled = !submitting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier
                        .weight(1.4f)
                        .height(52.dp)
                        .testTag("emergency_submit_button")
                ) {
                    if (submitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onError
                        )
                    } else {
                        Icon(
                            imageVector = if (isOffline) Icons.Outlined.CloudUpload else Icons.Outlined.Send,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = L10n.text(
                                locale,
                                if (isOffline) "emergencySaveOfflineCta" else "emergencySubmitCta"
                            ),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
