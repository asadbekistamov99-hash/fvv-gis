package uz.fvvgis.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.model.GisRegistryItem
import uz.fvvgis.app.data.model.RegistryGeometryType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegistryMarkerDetailSheet(
    marker: GisRegistryItem,
    locale: AppLocale,
    isEmployee: Boolean,
    onDismiss: () -> Unit,
    onCenterOnMarker: (GisRegistryItem) -> Unit,
    onFindRoute: (GisRegistryItem) -> Unit,
    onOpenPassport: (String) -> Unit
) {
    val geometryLabel = when (marker.geometryType) {
        RegistryGeometryType.POINT -> L10n.text(locale, "point")
        RegistryGeometryType.LINE -> L10n.text(locale, "line")
        RegistryGeometryType.POLYGON -> L10n.text(locale, "polygon")
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("registry_marker_detail_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(48.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = when {
                                marker.categoryId.contains("hydrant") -> Icons.Outlined.LocalFireDepartment
                                marker.categoryId.contains("water") || marker.categoryId.contains("reservoir") -> Icons.Outlined.WaterDrop
                                marker.categoryId.contains("gas") -> Icons.Outlined.PropaneTank
                                marker.categoryId.contains("electr") || marker.categoryId.contains("substation") -> Icons.Outlined.Bolt
                                else -> Icons.Outlined.LocationOn
                            },
                            contentDescription = marker.categoryName,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = marker.code,
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = marker.name,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusPill(marker.operationalStatus, locale)
                if (isEmployee) {
                    StatusPill(marker.lifecycle, locale)
                }
                if (marker.isSynthetic) {
                    SyntheticBadge(locale)
                }
            }

            if (marker.description.isNotBlank()) {
                Text(
                    text = marker.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    DataRowView(L10n.text(locale, "itemType"), marker.categoryName)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    DataRowView(L10n.text(locale, "region"), marker.regionName)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    DataRowView(L10n.text(locale, "geometry"), geometryLabel)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    DataRowView(
                        L10n.text(locale, "coordinates"),
                        "${"%.5f".format(marker.markerCoordinate.lat)}° N, ${"%.5f".format(marker.markerCoordinate.lon)}° E"
                    )
                    if (marker.accuracyM != null) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        DataRowView(
                            L10n.text(locale, "accuracy"),
                            "±${"%.1f".format(marker.accuracyM)} m"
                        )
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    DataRowView(L10n.text(locale, "updated"), marker.updatedAt)
                }
            }

            Button(
                onClick = { onFindRoute(marker) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("marker_sheet_route_button")
            ) {
                Icon(Icons.Outlined.Directions, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = L10n.text(locale, "shortestRoute"),
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = { onCenterOnMarker(marker) },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("marker_sheet_center_button")
                ) {
                    Icon(Icons.Outlined.CenterFocusStrong, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(L10n.text(locale, "centerOnMap"), maxLines = 1)
                }
                if (isEmployee) {
                    FilledTonalButton(
                        onClick = { onOpenPassport(marker.id) },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("map_open_passport_button")
                    ) {
                        Icon(Icons.Outlined.Description, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text(L10n.text(locale, "technicalPassport"), maxLines = 1)
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}
