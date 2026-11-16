package uz.fvvgis.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.CategoryEntity
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.data.repository.FvvRepository
import uz.fvvgis.app.ui.components.*
import uz.fvvgis.app.ui.viewmodel.MainUiState

private data class TechFieldDef(
    val key: String,
    val uz: String,
    val ru: String,
    val en: String,
    val numeric: Boolean = false,
    val date: Boolean = false
) {
    fun label(locale: AppLocale): String = when (locale) {
        AppLocale.RU -> ru
        AppLocale.EN -> en
        AppLocale.UZ -> uz
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ObjectFormScreen(
    state: MainUiState,
    objectId: String?,
    existingObject: InfrastructureObjectEntity?,
    regions: List<RegionEntity>,
    categories: List<CategoryEntity>,
    repo: FvvRepository,
    onSaved: (String) -> Unit,
    onShowMessage: (String) -> Unit,
    onOpenAuth: () -> Unit
) {
    val locale = state.locale
    if (!state.isEmployee) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(L10n.text(locale, "pendingVerification"), modifier = Modifier.padding(horizontal = 24.dp))
                Button(onClick = onOpenAuth) { Text(L10n.text(locale, "login")) }
            }
        }
        return
    }

    val scope = rememberCoroutineScope()
    val draftKey = objectId ?: "new-object"
    var step by remember { mutableIntStateOf(0) }
    var categoryId by remember { mutableStateOf(categories.firstOrNull()?.id ?: "fire_hydrant") }
    var regionId by remember { mutableStateOf(regions.firstOrNull()?.id ?: "UZ-TK") }
    var geometryType by remember { mutableStateOf("Point") }
    val vertices = remember { mutableStateListOf<GeoPoint>() }
    var latInput by remember { mutableStateOf("41.2995") }
    var lonInput by remember { mutableStateOf("69.2401") }
    var accuracyM by remember { mutableStateOf<Double?>(null) }
    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("unknown") }
    val technicalValues = remember { mutableStateMapOf<String, String>() }
    val attachments = remember { mutableStateListOf<Pair<String, String>>() }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var draftSaved by remember { mutableStateOf(false) }
    var initialized by remember { mutableStateOf(false) }
    var mapViewport by remember { mutableStateOf(MapViewport(41.2995, 69.2401, zoom = 6f)) }

    // Load existing object or saved draft once
    LaunchedEffect(objectId, existingObject) {
        if (initialized) return@LaunchedEffect
        if (existingObject != null) {
            categoryId = existingObject.categoryId
            regionId = existingObject.regionId
            code = existingObject.code
            name = existingObject.name
            description = existingObject.description
            status = existingObject.operationalStatus
            accuracyM = existingObject.accuracyM
            GeoUtils.parseGeoJson(existingObject.geometryJson)?.let { geom ->
                geometryType = when (geom) {
                    is uz.fvvgis.app.core.ParsedGeometry.Point -> "Point"
                    is uz.fvvgis.app.core.ParsedGeometry.LineString -> "LineString"
                    is uz.fvvgis.app.core.ParsedGeometry.Polygon -> "Polygon"
                }
                vertices.clear()
                vertices.addAll(geom.allPoints())
                vertices.firstOrNull()?.let {
                    latInput = "%.6f".format(it.lat)
                    lonInput = "%.6f".format(it.lon)
                    mapViewport = MapViewport(it.lat, it.lon, zoom = 8f)
                }
            }
            runCatching {
                Json.parseToJsonElement(existingObject.passportJson).jsonObject.forEach { (k, v) ->
                    if (k != "schema_version" && v is JsonPrimitive && v.content != "null") {
                        technicalValues[k] = v.content
                    }
                }
            }
            initialized = true
        } else if (objectId == null) {
            val saved = repo.getDraft(draftKey)
            if (saved != null) {
                runCatching {
                    val obj = Json.parseToJsonElement(saved).jsonObject
                    obj["categoryId"]?.jsonPrimitive?.contentOrNull?.let { categoryId = it }
                    obj["regionId"]?.jsonPrimitive?.contentOrNull?.let { regionId = it }
                    obj["code"]?.jsonPrimitive?.contentOrNull?.let { code = it }
                    obj["name"]?.jsonPrimitive?.contentOrNull?.let { name = it }
                    obj["description"]?.jsonPrimitive?.contentOrNull?.let { description = it }
                    obj["status"]?.jsonPrimitive?.contentOrNull?.let { status = it }
                }
            }
            initialized = true
        }
    }

    // Autosave draft
    LaunchedEffect(categoryId, regionId, code, name, description, status) {
        if (!initialized || objectId != null) return@LaunchedEffect
        delay(650)
        val jsonStr = JsonObject(
            mapOf(
                "categoryId" to JsonPrimitive(categoryId),
                "regionId" to JsonPrimitive(regionId),
                "code" to JsonPrimitive(code),
                "name" to JsonPrimitive(name),
                "description" to JsonPrimitive(description),
                "status" to JsonPrimitive(status)
            )
        ).toString()
        repo.saveDraft(draftKey, jsonStr)
        draftSaved = true
    }

    val fieldsForCategory = remember(categoryId) {
        when {
            categoryId.contains("hydrant") -> listOf(
                TechFieldDef("hydrant_type", "Gidrant turi", "Тип гидранта", "Hydrant type"),
                TechFieldDef("installation_type", "O‘rnatish turi", "Способ установки", "Installation type"),
                TechFieldDef("manufacturer", "Ishlab chiqaruvchi", "Производитель", "Manufacturer"),
                TechFieldDef("connection_diameter_mm", "Ulanish diametri · mm", "Диаметр · мм", "Connection diameter · mm", numeric = true),
                TechFieldDef("nominal_pressure_kpa", "Nominal bosim · kPa", "Номинальное давление · кПа", "Nominal pressure · kPa", numeric = true),
                TechFieldDef("measured_pressure_kpa", "O‘lchangan bosim · kPa", "Измеренное давление · кПа", "Measured pressure · kPa", numeric = true),
                TechFieldDef("flow_lps", "Suv sarfi · L/s", "Расход · л/с", "Flow · L/s", numeric = true),
                TechFieldDef("measurement_date", "O‘lchov vaqti · ISO 8601", "Время измерения", "Measurement timestamp", date = true),
                TechFieldDef("notes", "Izohlar", "Примечания", "Notes")
            )
            categoryId.contains("electr") || categoryId.contains("substation") -> listOf(
                TechFieldDef("voltage_kv", "Kuchlanish · kV", "Напряжение · кВ", "Voltage · kV", numeric = true),
                TechFieldDef("cable_type", "Kabel turi", "Тип кабеля", "Cable type"),
                TechFieldDef("installation_method", "O‘rnatish usuli", "Способ установки", "Installation method"),
                TechFieldDef("notes", "Izohlar", "Примечания", "Notes")
            )
            categoryId.contains("gas") -> listOf(
                TechFieldDef("diameter_mm", "Diametr · mm", "Диаметр · мм", "Diameter · mm", numeric = true),
                TechFieldDef("material", "Material", "Материал", "Material"),
                TechFieldDef("classification", "Tasnif", "Классификация", "Classification"),
                TechFieldDef("notes", "Izohlar", "Примечания", "Notes")
            )
            categoryId.contains("water") || categoryId.contains("reservoir") || categoryId.contains("pumping") -> listOf(
                TechFieldDef("diameter_mm", "Diametr · mm", "Диаметр · мм", "Diameter · mm", numeric = true),
                TechFieldDef("material", "Material", "Материал", "Material"),
                TechFieldDef("length_m", "Uzunlik · m", "Длина · м", "Length · m", numeric = true),
                TechFieldDef("pressure_kpa", "Bosim · kPa", "Давление · кПа", "Pressure · kPa", numeric = true),
                TechFieldDef("capacity_m3", "Sig‘im · m³", "Объём · м³", "Capacity · m³", numeric = true),
                TechFieldDef("notes", "Izohlar", "Примечания", "Notes")
            )
            else -> listOf(
                TechFieldDef("material", "Material", "Материал", "Material"),
                TechFieldDef("notes", "Izohlar", "Примечания", "Notes")
            )
        }
    }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) {
            attachments.add("photo_${attachments.size + 1}.jpg" to uri.toString())
        }
    }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            attachments.add("doc_${attachments.size + 1}.pdf" to uri.toString())
        }
    }

    val requestGps = rememberLocationRequester { fix, msg ->
        if (fix != null) {
            if (geometryType == "Point") vertices.clear()
            vertices.add(fix.point)
            latInput = "%.6f".format(fix.point.lat)
            lonInput = "%.6f".format(fix.point.lon)
            accuracyM = fix.accuracyMeters
            mapViewport = MapViewport(fix.point.lat, fix.point.lon, zoom = 10f)
        }
        if (msg != null) onShowMessage(msg)
    }

    val stepTitles = listOf(
        L10n.text(locale, "category"),
        L10n.text(locale, "geometry"),
        L10n.text(locale, "description"),
        L10n.text(locale, "technicalPassport"),
        L10n.text(locale, "attachments"),
        L10n.text(locale, "review")
    )

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${L10n.text(locale, "add")} · ${step + 1}/${stepTitles.size}",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                modifier = Modifier.weight(1f)
            )
            if (draftSaved) {
                Icon(Icons.Outlined.CloudDone, contentDescription = "Draft saved", tint = MaterialTheme.colorScheme.secondary)
            }
        }
        LinearProgressIndicator(
            progress = { (step + 1) / stepTitles.size.toFloat() },
            modifier = Modifier.fillMaxWidth()
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stepTitles[step],
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
            )

            when (step) {
                0 -> {
                    var catExp by remember { mutableStateOf(false) }
                    var regExp by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = catExp, onExpandedChange = { catExp = !catExp }) {
                        val catName = categories.firstOrNull { it.id == categoryId }?.localizedName(locale.code) ?: categoryId
                        OutlinedTextField(
                            value = catName,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "category")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(catExp) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = catExp, onDismissRequest = { catExp = false }) {
                            categories.forEach { c ->
                                DropdownMenuItem(
                                    text = { Text(c.localizedName(locale.code)) },
                                    onClick = { categoryId = c.id; catExp = false }
                                )
                            }
                        }
                    }

                    ExposedDropdownMenuBox(expanded = regExp, onExpandedChange = { regExp = !regExp }) {
                        val regName = regions.firstOrNull { it.id == regionId }?.localizedName(locale.code) ?: regionId
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
                                    onClick = {
                                        regionId = r.id
                                        mapViewport = MapViewport(r.centerLat, r.centerLon, zoom = 6f)
                                        regExp = false
                                    }
                                )
                            }
                        }
                    }
                }

                1 -> {
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        listOf("Point" to "point", "LineString" to "line", "Polygon" to "polygon").forEachIndexed { idx, (type, key) ->
                            SegmentedButton(
                                selected = geometryType == type,
                                onClick = { geometryType = type; vertices.clear() },
                                shape = SegmentedButtonDefaults.itemShape(idx, 3)
                            ) { Text(L10n.text(locale, key)) }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp)
                            .clip(RoundedCornerShape(16.dp))
                    ) {
                        UzbekistanGisCanvas(
                            objects = emptyList(),
                            regions = regions,
                            localeCode = locale.code,
                            darkTheme = state.darkTheme,
                            viewport = mapViewport,
                            onViewportChange = { mapViewport = it },
                            pickedVertices = vertices,
                            onMapTap = { pt ->
                                if (geometryType == "Point") vertices.clear()
                                vertices.add(pt)
                                latInput = "%.6f".format(pt.lat)
                                lonInput = "%.6f".format(pt.lon)
                            }
                        )
                    }

                    OutlinedButton(
                        onClick = requestGps,
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Icon(Icons.Outlined.MyLocation, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(L10n.text(locale, "gps"))
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = latInput,
                            onValueChange = { latInput = it },
                            label = { Text(L10n.text(locale, "latitude")) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = lonInput,
                            onValueChange = { lonInput = it },
                            label = { Text(L10n.text(locale, "longitude")) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            val lat = latInput.toDoubleOrNull()
                            val lon = lonInput.toDoubleOrNull()
                            if (lat == null || lon == null || kotlin.math.abs(lat) > 90 || kotlin.math.abs(lon) > 180) {
                                formError = "Koordinatalar noto‘g‘ri"
                            } else {
                                formError = null
                                if (geometryType == "Point") vertices.clear()
                                vertices.add(GeoPoint(lat, lon))
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Icon(Icons.Outlined.AddLocationAlt, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(L10n.text(locale, "add"))
                    }

                    vertices.forEachIndexed { idx, pt ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            Text("${idx + 1}. ${"%.5f".format(pt.lat)}, ${"%.5f".format(pt.lon)}", modifier = Modifier.weight(1f))
                            IconButton(onClick = { vertices.removeAt(idx) }) {
                                Icon(Icons.Outlined.Close, contentDescription = "Remove point")
                            }
                        }
                    }
                }

                2 -> {
                    OutlinedTextField(
                        value = code,
                        onValueChange = { code = it },
                        label = { Text("${L10n.text(locale, "codeLabel")} *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("form_code_input")
                    )
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("${L10n.text(locale, "objectName")} *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("form_name_input")
                    )
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text(L10n.text(locale, "description")) },
                        minLines = 3,
                        maxLines = 5,
                        modifier = Modifier.fillMaxWidth()
                    )
                    var statusExp by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = statusExp, onExpandedChange = { statusExp = !statusExp }) {
                        OutlinedTextField(
                            value = L10n.text(locale, status),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "status")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(statusExp) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = statusExp, onDismissRequest = { statusExp = false }) {
                            listOf("working", "faulty", "under_maintenance", "temporarily_unavailable", "not_inspected", "unknown").forEach { s ->
                                DropdownMenuItem(
                                    text = { Text(L10n.text(locale, s)) },
                                    onClick = { status = s; statusExp = false }
                                )
                            }
                        }
                    }
                }

                3 -> {
                    fieldsForCategory.forEach { field ->
                        OutlinedTextField(
                            value = technicalValues[field.key] ?: "",
                            onValueChange = { technicalValues[field.key] = it },
                            label = { Text(field.label(locale)) },
                            placeholder = if (field.date) { { Text("YYYY-MM-DD") } } else null,
                            keyboardOptions = if (field.numeric) KeyboardOptions(keyboardType = KeyboardType.Decimal) else KeyboardOptions.Default,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                4 -> {
                    OutlinedButton(
                        onClick = {
                            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Icon(Icons.Outlined.PhotoLibrary, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(L10n.text(locale, "addPhoto"))
                    }
                    OutlinedButton(
                        onClick = { filePicker.launch(arrayOf("application/pdf", "image/*")) },
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Icon(Icons.Outlined.AttachFile, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(L10n.text(locale, "addFile"))
                    }
                    attachments.forEachIndexed { idx, (fname, _) ->
                        SectionCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.Description, contentDescription = null)
                                Spacer(Modifier.width(12.dp))
                                Text(fname, modifier = Modifier.weight(1f))
                                IconButton(onClick = { attachments.removeAt(idx) }) {
                                    Icon(Icons.Outlined.DeleteOutline, contentDescription = "Remove")
                                }
                            }
                        }
                    }
                }

                5 -> {
                    DataRowView(L10n.text(locale, "codeLabel"), code)
                    DataRowView(L10n.text(locale, "objectName"), name)
                    StatusPill(status, locale)
                    DataRowView(L10n.text(locale, "geometry"), "$geometryType · ${vertices.size}")
                    fieldsForCategory.filter { !technicalValues[it.key].isNullOrBlank() }.forEach { f ->
                        DataRowView(f.label(locale), technicalValues[f.key])
                    }
                    DataRowView(L10n.text(locale, "attachments"), attachments.size)
                    Text(
                        text = L10n.text(locale, if (state.isEffectiveOffline) "offline" else "draft"),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (formError != null) {
                Text(formError!!, color = MaterialTheme.colorScheme.error)
            }
        }

        Surface(tonalElevation = 3.dp) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (step > 0) {
                    OutlinedButton(
                        enabled = !busy,
                        onClick = { formError = null; step-- },
                        modifier = Modifier.height(52.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = L10n.text(locale, "cancel"))
                    }
                }
                Button(
                    enabled = !busy,
                    onClick = {
                        formError = null
                        if (step < 5) {
                            step++
                            return@Button
                        }
                        if (name.trim().isEmpty() || code.trim().isEmpty()) {
                            formError = "Obyekt nomi va kodi majburiy."
                            return@Button
                        }
                        val minPts = when (geometryType) {
                            "LineString" -> 2
                            "Polygon" -> 3
                            else -> 1
                        }
                        if (vertices.size < minPts) {
                            formError = "Geometriya uchun kamida $minPts nuqta belgilang."
                            return@Button
                        }
                        busy = true
                        scope.launch {
                            val passportMap = mutableMapOf<String, JsonElement>("schema_version" to JsonPrimitive(1))
                            fieldsForCategory.forEach { f ->
                                val raw = technicalValues[f.key]?.trim().orEmpty()
                                if (raw.isNotEmpty()) {
                                    passportMap[f.key] = if (f.numeric) {
                                        raw.toDoubleOrNull()?.let { JsonPrimitive(it) } ?: JsonPrimitive(raw)
                                    } else {
                                        JsonPrimitive(raw)
                                    }
                                }
                            }
                            val res = repo.saveInfrastructureObject(
                                existingId = objectId,
                                code = code,
                                name = name,
                                description = description,
                                categoryId = categoryId,
                                regionId = regionId,
                                geometryJson = GeoUtils.encodeGeoJson(geometryType, vertices),
                                operationalStatus = status,
                                passportJson = JsonObject(passportMap).toString(),
                                accuracyM = accuracyM,
                                attachments = attachments.toList(),
                                isOffline = state.isEffectiveOffline
                            )
                            busy = false
                            res.fold(
                                onSuccess = { result ->
                                    if (result.startsWith("QUEUED:")) {
                                        onShowMessage("Qoralama sinxronlash navbatida saqlandi.")
                                    } else {
                                        onShowMessage("Obyekt saqlandi.")
                                    }
                                    onSaved(result.removePrefix("QUEUED:"))
                                },
                                onFailure = { e -> formError = e.message }
                            )
                        }
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("form_next_or_save_button")
                ) {
                    if (busy) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(
                            imageVector = if (step == 5) Icons.Outlined.Save else Icons.AutoMirrored.Outlined.ArrowForward,
                            contentDescription = null
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(L10n.text(locale, if (step == 5) "saveDraft" else "continue"))
                    }
                }
            }
        }
    }
}
