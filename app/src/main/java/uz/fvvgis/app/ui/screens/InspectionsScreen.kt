package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.InfrastructureObjectEntity
import uz.fvvgis.app.data.local.InspectionEntity
import uz.fvvgis.app.ui.components.DataRowView
import uz.fvvgis.app.ui.components.EmptyPanel
import uz.fvvgis.app.ui.components.SectionCard
import uz.fvvgis.app.ui.components.StatusPill
import uz.fvvgis.app.ui.viewmodel.MainUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InspectionsScreen(
    state: MainUiState,
    objects: List<InfrastructureObjectEntity>,
    observeInspections: (String) -> kotlinx.coroutines.flow.Flow<List<InspectionEntity>>,
    onAddInspection: (objectId: String, condition: String, status: String, notes: String, nextDate: String?) -> Unit
) {
    val locale = state.locale
    if (!state.isEmployee) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(L10n.text(locale, "pendingVerification"), modifier = Modifier.padding(24.dp))
        }
        return
    }

    var selectedObjectId by remember { mutableStateOf(objects.firstOrNull()?.id) }
    LaunchedEffect(objects) {
        if (selectedObjectId == null && objects.isNotEmpty()) {
            selectedObjectId = objects.first().id
        }
    }

    val inspections by remember(selectedObjectId) {
        selectedObjectId?.let { observeInspections(it) } ?: kotlinx.coroutines.flow.flowOf(emptyList())
    }.collectAsState(initial = emptyList())

    var objExpanded by remember { mutableStateOf(false) }
    var showAddDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = L10n.text(locale, "inspections"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )

        ExposedDropdownMenuBox(expanded = objExpanded, onExpandedChange = { objExpanded = !objExpanded }) {
            val selectedObj = objects.firstOrNull { it.id == selectedObjectId }
            OutlinedTextField(
                value = selectedObj?.let { "${it.code} · ${it.name}" } ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text(L10n.text(locale, "objectName")) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(objExpanded) },
                modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
            )
            ExposedDropdownMenu(expanded = objExpanded, onDismissRequest = { objExpanded = false }) {
                objects.forEach { obj ->
                    DropdownMenuItem(
                        text = { Text("${obj.code} · ${obj.name}") },
                        onClick = { selectedObjectId = obj.id; objExpanded = false }
                    )
                }
            }
        }

        Button(
            enabled = selectedObjectId != null,
            onClick = { showAddDialog = true },
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("inspections_add_button")
        ) {
            Icon(Icons.Outlined.FactCheck, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "check"))
        }

        if (inspections.isEmpty()) {
            EmptyPanel(locale = locale, icon = Icons.Outlined.FactCheck)
        } else {
            inspections.forEach { insp ->
                SectionCard {
                    StatusPill(insp.operationalStatus, locale)
                    Spacer(Modifier.height(8.dp))
                    DataRowView(L10n.text(locale, "description"), insp.notes)
                    DataRowView(L10n.text(locale, "review"), L10n.text(locale, insp.condition))
                    DataRowView(L10n.text(locale, "updated"), insp.createdAt)
                    if (insp.nextInspectionDate != null) {
                        DataRowView("Keyingi tekshiruv", insp.nextInspectionDate)
                    }
                }
            }
        }
    }

    if (showAddDialog && selectedObjectId != null) {
        var status by remember { mutableStateOf("working") }
        var condition by remember { mutableStateOf("good") }
        var notes by remember { mutableStateOf("") }
        var nextDate by remember { mutableStateOf("2027-01-15") }
        var error by remember { mutableStateOf<String?>(null) }
        var stExp by remember { mutableStateOf(false) }
        var condExp by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text(L10n.text(locale, "check")) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ExposedDropdownMenuBox(expanded = stExp, onExpandedChange = { stExp = !stExp }) {
                        OutlinedTextField(
                            value = L10n.text(locale, status),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "status")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(stExp) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = stExp, onDismissRequest = { stExp = false }) {
                            listOf("working", "faulty", "under_maintenance", "not_inspected", "unknown").forEach { s ->
                                DropdownMenuItem(text = { Text(L10n.text(locale, s)) }, onClick = { status = s; stExp = false })
                            }
                        }
                    }
                    ExposedDropdownMenuBox(expanded = condExp, onExpandedChange = { condExp = !condExp }) {
                        OutlinedTextField(
                            value = L10n.text(locale, condition),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "review")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(condExp) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = condExp, onDismissRequest = { condExp = false }) {
                            listOf("good", "fair", "poor", "unknown").forEach { c ->
                                DropdownMenuItem(text = { Text(L10n.text(locale, c)) }, onClick = { condition = c; condExp = false })
                            }
                        }
                    }
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text(L10n.text(locale, "description")) },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth().testTag("inspection_notes_input")
                    )
                    OutlinedTextField(
                        value = nextDate,
                        onValueChange = { nextDate = it },
                        label = { Text("YYYY-MM-DD") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (error != null) {
                        Text(error!!, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (notes.trim().isEmpty()) {
                            error = L10n.text(locale, "required")
                            return@Button
                        }
                        onAddInspection(selectedObjectId!!, condition, status, notes, nextDate)
                        showAddDialog = false
                    },
                    modifier = Modifier.testTag("inspection_save_button")
                ) { Text(L10n.text(locale, "save")) }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) { Text(L10n.text(locale, "cancel")) }
            }
        )
    }
}
