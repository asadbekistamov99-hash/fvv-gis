package uz.fvvgis.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.CitizenReportEntity
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.ui.components.*
import uz.fvvgis.app.ui.viewmodel.MainUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportScreen(
    state: MainUiState,
    regions: List<RegionEntity>,
    onSubmit: (category: String, description: String, regionId: String, location: GeoPoint?, attachmentCount: Int) -> Unit,
    onOpenAuth: () -> Unit,
    onShowMessage: (String) -> Unit
) {
    val locale = state.locale
    if (state.account == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Button(onClick = onOpenAuth, modifier = Modifier.testTag("report_login_button")) {
                Text(L10n.text(locale, "login"))
            }
        }
        return
    }

    val categories = mapOf(
        "infrastructure_fault" to L10n.pick(locale, "Infratuzilma nosozligi", "Неисправность инфраструктуры", "Infrastructure fault"),
        "fire" to L10n.pick(locale, "Yong‘in haqidagi ma’lumot", "Информация о пожаре", "Fire information"),
        "flood" to L10n.pick(locale, "Suv toshqini", "Подтопление", "Flooding"),
        "gas_leak" to L10n.pick(locale, "Gaz sizishi", "Утечка газа", "Gas leak"),
        "other" to L10n.pick(locale, "Boshqa", "Другое", "Other")
    )

    var selectedCategory by remember { mutableStateOf("infrastructure_fault") }
    var selectedRegionId by remember { mutableStateOf(regions.firstOrNull()?.id ?: "UZ-TK") }
    var description by remember { mutableStateOf("") }
    var location by remember { mutableStateOf<GeoPoint?>(null) }
    val photos = remember { mutableStateListOf<Uri>() }
    var catExp by remember { mutableStateOf(false) }
    var regExp by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) photos.add(uri)
    }

    val requestGps = rememberLocationRequester { fix, msg ->
        if (fix != null) location = fix.point
        if (msg != null) onShowMessage(msg)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = L10n.text(locale, "newReport"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )
        Text(
            text = L10n.text(locale, "nonEmergency"),
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.primary
        )
        SectionCard {
            Text(
                text = L10n.text(locale, "emergencyNotice"),
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
            )
        }
        SyntheticBadge(locale)

        ExposedDropdownMenuBox(expanded = catExp, onExpandedChange = { catExp = !catExp }) {
            OutlinedTextField(
                value = categories[selectedCategory] ?: selectedCategory,
                onValueChange = {},
                readOnly = true,
                label = { Text(L10n.text(locale, "category")) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(catExp) },
                modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = catExp, onDismissRequest = { catExp = false }) {
                categories.forEach { (key, label) ->
                    DropdownMenuItem(text = { Text(label) }, onClick = { selectedCategory = key; catExp = false })
                }
            }
        }

        ExposedDropdownMenuBox(expanded = regExp, onExpandedChange = { regExp = !regExp }) {
            val regName = regions.firstOrNull { it.id == selectedRegionId }?.localizedName(locale.code) ?: selectedRegionId
            OutlinedTextField(
                value = regName,
                onValueChange = {},
                readOnly = true,
                label = { Text(L10n.text(locale, "region")) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(regExp) },
                modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = regExp, onDismissRequest = { regExp = false }) {
                regions.forEach { r ->
                    DropdownMenuItem(
                        text = { Text(r.localizedName(locale.code)) },
                        onClick = { selectedRegionId = r.id; regExp = false }
                    )
                }
            }
        }

        OutlinedTextField(
            value = description,
            onValueChange = { if (it.length <= 4000) description = it },
            label = { Text("${L10n.text(locale, "description")} *") },
            minLines = 4,
            maxLines = 8,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("report_description_input")
        )

        OutlinedButton(
            onClick = requestGps,
            modifier = Modifier.fillMaxWidth().height(50.dp).testTag("report_gps_button")
        ) {
            Icon(Icons.Outlined.MyLocation, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "includeLocation"))
        }

        location?.let { pt ->
            SectionCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Text("${"%.5f".format(pt.lat)}, ${"%.5f".format(pt.lon)}", modifier = Modifier.weight(1f))
                    IconButton(onClick = { location = null }) {
                        Icon(Icons.Outlined.Close, contentDescription = L10n.text(locale, "cancel"))
                    }
                }
            }
        }

        OutlinedButton(
            onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.fillMaxWidth().height(50.dp).testTag("report_photo_button")
        ) {
            Icon(Icons.Outlined.CameraAlt, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "addPhoto"))
        }

        if (photos.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                photos.forEachIndexed { idx, uri ->
                    Box(modifier = Modifier.size(110.dp)) {
                        AsyncImage(
                            model = uri,
                            contentDescription = L10n.text(locale, "attachments"),
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp))
                        )
                        FilledIconButton(
                            onClick = { photos.removeAt(idx) },
                            modifier = Modifier.align(Alignment.TopEnd).size(32.dp)
                        ) {
                            Icon(Icons.Outlined.Close, contentDescription = "Remove photo", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error)
        }

        if (state.isEffectiveOffline) {
            SectionCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CloudUpload,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = L10n.text(locale, "emergencyOfflineSheetHint"),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        Button(
            onClick = {
                if (description.trim().length < 10) {
                    error = L10n.pick(locale, "Kamida 10 ta belgi kiriting.", "Введите не менее 10 символов.", "Enter at least 10 characters.")
                    return@Button
                }
                error = null
                onSubmit(selectedCategory, description, selectedRegionId, location, photos.size)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("report_send_button")
        ) {
            Icon(
                imageVector = if (state.isEffectiveOffline) Icons.Outlined.CloudUpload else Icons.AutoMirrored.Outlined.Send,
                contentDescription = null
            )
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, if (state.isEffectiveOffline) "emergencySaveOfflineCta" else "send"))
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
fun MyReportsScreen(
    state: MainUiState,
    reports: List<CitizenReportEntity>,
    onOpenAuth: () -> Unit
) {
    val locale = state.locale
    if (state.account == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Button(onClick = onOpenAuth) { Text(L10n.text(locale, "login")) }
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = L10n.text(locale, "reports"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )

        if (reports.isEmpty()) {
            EmptyPanel(locale = locale, icon = Icons.Outlined.Assignment)
        } else {
            reports.forEach { rep ->
                SectionCard {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Outlined.Assignment, contentDescription = null)
                        Text(rep.category, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold))
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(rep.description, style = MaterialTheme.typography.bodyLarge)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        StatusPill(rep.status, locale)
                        if (rep.isSynthetic) SyntheticBadge(locale)
                    }
                    Spacer(Modifier.height(8.dp))
                    DataRowView(L10n.text(locale, "updated"), rep.updatedAt)
                    if (rep.resolution != null) {
                        DataRowView(L10n.text(locale, "description"), rep.resolution)
                    }
                }
            }
        }
    }
}
