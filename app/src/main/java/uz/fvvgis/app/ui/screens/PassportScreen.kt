package uz.fvvgis.app.ui.screens

import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import uz.fvvgis.app.R
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.data.local.ObjectAttachmentEntity
import uz.fvvgis.app.ui.components.*
import uz.fvvgis.app.ui.viewmodel.MainUiState

@Composable
fun PassportScreen(
    state: MainUiState,
    item: InfrastructureObjectEntity?,
    attachments: List<ObjectAttachmentEntity>,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
    onSubmitForReview: (String) -> Unit,
    onReviewObject: (String, Boolean) -> Unit,
    onRequestRoute: (String, GeoPoint) -> Unit,
    onSimulateConflict: (String) -> Unit
) {
    val locale = state.locale
    var showConfirmSubmit by remember { mutableStateOf(false) }
    var previewImageUri by remember { mutableStateOf<String?>(null) }

    val requestLocationForRoute = rememberLocationRequester { fix, _ ->
        val obj = item ?: return@rememberLocationRequester
        val origin = fix?.point ?: GeoPoint(41.2995, 69.2401)
        onRequestRoute(obj.id, origin)
    }

    if (item == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val passportMap = remember(item.passportJson) {
        runCatching {
            Json.parseToJsonElement(item.passportJson).jsonObject
                .mapValues { (_, v) -> if (v is JsonPrimitive && v.content != "null") v.content else null }
        }.getOrDefault(emptyMap())
    }

    val pressureVal = passportMap["measured_pressure_kpa"]
    val flowVal = passportMap["flow_lps"]
    val measurementDate = passportMap["measurement_date"]
    val labels = mapOf(
        "hydrant_type" to "Gidrant turi",
        "installation_type" to "O‘rnatish turi",
        "installation_year" to "O‘rnatilgan yil",
        "manufacturer" to "Ishlab chiqaruvchi",
        "model" to "Model",
        "material" to "Material",
        "connection_diameter_mm" to "Ulanish diametri · mm",
        "nominal_pressure_kpa" to "Nominal bosim · kPa",
        "accessibility_status" to "Kirish imkoniyati",
        "visible_condition" to "Tashqi holat",
        "last_inspection_date" to "Oxirgi tekshiruv",
        "next_inspection_date" to "Keyingi tekshiruv",
        "defect_description" to "Nuqson",
        "notes" to "Izohlar",
        "diameter_mm" to "Diametr · mm",
        "length_m" to "Uzunlik · m",
        "depth_m" to "Chuqurlik · m",
        "pressure_kpa" to "Bosim · kPa",
        "voltage_kv" to "Kuchlanish · kV",
        "capacity_m3" to "Sig‘im · m³"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.minimumInteractiveComponentSize()
            ) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = stringResource(R.string.content_desc_back))
            }
            Text(
                text = L10n.text(locale, "technicalPassport"),
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )
        }

        Text(
            text = item.code,
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.ExtraBold),
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = item.name,
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            StatusPill(item.operationalStatus, locale)
            StatusPill(item.lifecycle, locale)
            if (item.isSynthetic) SyntheticBadge(locale)
        }

        SectionCard(title = L10n.text(locale, "measurement")) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(L10n.text(locale, "pressure"), style = MaterialTheme.typography.labelMedium)
                    Text(
                        text = pressureVal ?: "—",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
                    )
                    Text("kPa", style = MaterialTheme.typography.bodySmall)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(L10n.text(locale, "flow"), style = MaterialTheme.typography.labelMedium)
                    Text(
                        text = flowVal ?: "—",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
                    )
                    Text("L/s", style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(10.dp))
            DataRowView(L10n.text(locale, "measurement"), measurementDate)
            if (measurementDate == null) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.errorContainer,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "${L10n.text(locale, "offline")} · ${L10n.text(locale, "measurement")}",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        SectionCard {
            DataRowView(L10n.text(locale, "description"), item.description)
            DataRowView(L10n.text(locale, "accuracy"), item.accuracyM?.let { "±$it m" })
            DataRowView(L10n.text(locale, "updated"), item.updatedAt)
            DataRowView("Versiya", "v${item.version}")
            passportMap.entries
                .filter { it.key !in setOf("measured_pressure_kpa", "flow_lps", "measurement_date", "schema_version") && it.value != null }
                .forEach { (k, v) ->
                    DataRowView(labels[k] ?: k, v)
                }
        }

        SectionCard(title = L10n.text(locale, "attachments")) {
            if (attachments.isEmpty()) {
                Text(L10n.text(locale, "empty"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                attachments.forEach { att ->
                    ListTileRow(
                        filename = att.filename,
                        subtitle = att.scanStatus,
                        onClick = {
                            if (att.mimeType.startsWith("image/")) previewImageUri = att.uriString
                        }
                    )
                }
            }
        }

        Button(
            onClick = { onEdit(item.id) },
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("passport_edit_button")
        ) {
            Icon(Icons.Outlined.Edit, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "edit"))
        }

        if (item.lifecycle in setOf("draft", "requires_correction", "rejected")) {
            OutlinedButton(
                onClick = { showConfirmSubmit = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("passport_submit_button")
            ) {
                Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, "submit"))
            }
        }

        if (state.account?.canReviewOrPublish == true && item.lifecycle == "submitted") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { onReviewObject(item.id, false) },
                    modifier = Modifier.weight(1f).height(52.dp).testTag("passport_reject_button")
                ) {
                    Text(L10n.text(locale, "reject"))
                }
                Button(
                    onClick = { onReviewObject(item.id, true) },
                    modifier = Modifier.weight(1f).height(52.dp).testTag("passport_publish_button")
                ) {
                    Text(L10n.text(locale, "publish"))
                }
            }
        }

        if (item.lifecycle == "published") {
            OutlinedButton(
                onClick = requestLocationForRoute,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("passport_request_route_button")
            ) {
                Icon(Icons.Outlined.Route, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, "requestRoute"))
            }
        }

        TextButton(
            onClick = { onSimulateConflict(item.id) },
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text(L10n.pick(locale, "Sinov konflikti (409) yaratish", "Создать тестовый конфликт (409)", "Simulate sync conflict (409)"))
        }

        Spacer(Modifier.height(16.dp))
    }

    if (showConfirmSubmit) {
        ConfirmDialog(
            title = L10n.text(locale, "submit"),
            locale = locale,
            onConfirm = {
                showConfirmSubmit = false
                onSubmitForReview(item.id)
            },
            onDismiss = { showConfirmSubmit = false }
        )
    }

    previewImageUri?.let { uriStr ->
        AlertDialog(
            onDismissRequest = { previewImageUri = null },
            confirmButton = { TextButton(onClick = { previewImageUri = null }) { Text("OK") } },
            text = {
                AsyncImage(
                    model = Uri.parse(uriStr),
                    contentDescription = L10n.text(locale, "attachments"),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp)
                )
            }
        )
    }
}

@Composable
private fun ListTileRow(filename: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(Icons.Outlined.AttachFile, contentDescription = null)
        Column(modifier = Modifier.weight(1f)) {
            Text(filename, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
