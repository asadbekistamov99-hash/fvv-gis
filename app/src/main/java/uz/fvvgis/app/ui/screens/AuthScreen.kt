package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.data.local.SeedData
import uz.fvvgis.app.ui.components.SectionCard
import uz.fvvgis.app.ui.components.SyntheticBadge
import uz.fvvgis.app.ui.viewmodel.MainUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    state: MainUiState,
    regions: List<RegionEntity>,
    onRequestLoginOtp: (String) -> Unit,
    onRequestRegisterOtp: (
        phone: String,
        fullName: String,
        isEmployee: Boolean,
        orgId: String?,
        regionId: String?,
        department: String?,
        reference: String?
    ) -> Unit,
    onVerifyOtp: (String) -> Unit,
    onCancelChallenge: () -> Unit,
    onOpenPublicMap: () -> Unit
) {
    val locale = state.locale
    var isRegister by remember { mutableStateOf(false) }
    var isEmployeeApp by remember { mutableStateOf(false) }
    var phone by remember { mutableStateOf("+998900000011") }
    var fullName by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var selectedOrgId by remember { mutableStateOf(SeedData.demoOrganizations.first().first) }
    var selectedRegionId by remember { mutableStateOf(regions.firstOrNull()?.id ?: "UZ-TK") }
    var department by remember { mutableStateOf("") }
    var reference by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    var orgExpanded by remember { mutableStateOf(false) }
    var regExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(regions) {
        if (regions.isNotEmpty() && regions.none { it.id == selectedRegionId }) {
            selectedRegionId = regions.first().id
        }
    }

    val challenge = state.authChallenge

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp)
            .widthIn(max = 560.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Outlined.Explore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(40.dp)
                )
            }
        }

        Text(
            text = if (challenge == null) L10n.text(locale, if (isRegister) "register" else "login")
            else L10n.text(locale, "code"),
            style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Black)
        )
        Text(
            text = L10n.text(locale, "independent"),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (challenge == null) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                SegmentedButton(
                    selected = !isRegister,
                    onClick = { isRegister = false; localError = null },
                    shape = SegmentedButtonDefaults.itemShape(0, 2),
                    modifier = Modifier.testTag("auth_mode_login")
                ) { Text(L10n.text(locale, "login")) }
                SegmentedButton(
                    selected = isRegister,
                    onClick = { isRegister = true; localError = null },
                    shape = SegmentedButtonDefaults.itemShape(1, 2),
                    modifier = Modifier.testTag("auth_mode_register")
                ) { Text(L10n.text(locale, "register")) }
            }

            if (!isRegister) {
                Text(
                    text = L10n.pick(locale, "Tezkor demo hisoblar:", "Быстрые демо-аккаунты:", "Quick demo accounts:"),
                    style = MaterialTheme.typography.labelLarge
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val quickAccounts = listOf(
                        "+998900000001" to L10n.text(locale, "citizen"),
                        "+998900000011" to "Xodim",
                        "+998900000031" to "Rahbar"
                    )
                    quickAccounts.forEach { (num, label) ->
                        FilterChip(
                            selected = phone == num,
                            onClick = { phone = num; localError = null },
                            label = { Text(label) },
                            modifier = Modifier.testTag("demo_chip_$num")
                        )
                    }
                }
            }

            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text(L10n.text(locale, "phone")) },
                leadingIcon = { Icon(Icons.Outlined.Phone, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("auth_phone_input")
            )

            if (isRegister) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text(L10n.text(locale, "name")) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("auth_name_input")
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(L10n.text(locale, "password")) },
                    supportingText = { Text(L10n.text(locale, "password_rules")) },
                    leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("auth_password_input")
                )
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    SegmentedButton(
                        selected = !isEmployeeApp,
                        onClick = { isEmployeeApp = false },
                        shape = SegmentedButtonDefaults.itemShape(0, 2)
                    ) { Text(L10n.text(locale, "citizen")) }
                    SegmentedButton(
                        selected = isEmployeeApp,
                        onClick = { isEmployeeApp = true },
                        shape = SegmentedButtonDefaults.itemShape(1, 2)
                    ) { Text(L10n.text(locale, "employee")) }
                }

                if (isEmployeeApp) {
                    Text(
                        text = L10n.text(locale, "pendingVerification"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    ExposedDropdownMenuBox(
                        expanded = orgExpanded,
                        onExpandedChange = { orgExpanded = !orgExpanded }
                    ) {
                        val orgLabel = SeedData.demoOrganizations.firstOrNull { it.first == selectedOrgId }?.second ?: ""
                        OutlinedTextField(
                            value = orgLabel,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "organization")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(orgExpanded) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = orgExpanded, onDismissRequest = { orgExpanded = false }) {
                            SeedData.demoOrganizations.forEach { (id, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = { selectedOrgId = id; orgExpanded = false }
                                )
                            }
                        }
                    }

                    ExposedDropdownMenuBox(
                        expanded = regExpanded,
                        onExpandedChange = { regExpanded = !regExpanded }
                    ) {
                        val regLabel = regions.firstOrNull { it.id == selectedRegionId }?.localizedName(locale.code) ?: selectedRegionId
                        OutlinedTextField(
                            value = regLabel,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(L10n.text(locale, "region")) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(regExpanded) },
                            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                        )
                        ExposedDropdownMenu(expanded = regExpanded, onDismissRequest = { regExpanded = false }) {
                            regions.forEach { r ->
                                DropdownMenuItem(
                                    text = { Text(r.localizedName(locale.code)) },
                                    onClick = { selectedRegionId = r.id; regExpanded = false }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = department,
                        onValueChange = { department = it },
                        label = { Text(L10n.text(locale, "department")) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = reference,
                        onValueChange = { reference = it },
                        label = { Text(L10n.text(locale, "reference")) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        } else {
            Text(challenge.phone, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            SectionCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SyntheticBadge(locale)
                    Text(
                        text = "OTP: ${challenge.devOtp}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
            OutlinedTextField(
                value = otpCode,
                onValueChange = { if (it.length <= 6) otpCode = it },
                label = { Text(L10n.text(locale, "code")) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("auth_otp_input")
            )
        }

        val err = localError ?: state.authError
        if (err != null) {
            Text(
                text = err,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        Button(
            enabled = !state.authBusy,
            onClick = {
                localError = null
                if (challenge == null) {
                    if (!Regex("^\\+998\\d{9}$").matches(phone.trim())) {
                        localError = "+998 XX XXX XX XX formatida kiriting."
                        return@Button
                    }
                    if (!isRegister) {
                        onRequestLoginOtp(phone)
                    } else {
                        if (fullName.trim().length < 2) {
                            localError = L10n.text(locale, "required")
                            return@Button
                        }
                        val strong = password.length >= 8 &&
                            password.any { it.isLetter() } &&
                            password.any { it.isDigit() }
                        if (!strong) {
                            localError = L10n.text(locale, "password_rules")
                            return@Button
                        }
                        if (isEmployeeApp && department.trim().isEmpty()) {
                            localError = L10n.text(locale, "required")
                            return@Button
                        }
                        onRequestRegisterOtp(
                            phone,
                            fullName,
                            isEmployeeApp,
                            if (isEmployeeApp) selectedOrgId else null,
                            if (isEmployeeApp) selectedRegionId else null,
                            department,
                            reference
                        )
                    }
                } else {
                    if (!Regex("^\\d{6}$").matches(otpCode.trim())) {
                        localError = L10n.text(locale, "required")
                        return@Button
                    }
                    onVerifyOtp(otpCode)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("auth_submit_button")
        ) {
            if (state.authBusy) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Icon(
                    imageVector = if (challenge == null) Icons.AutoMirrored.Outlined.ArrowForward else Icons.Outlined.VerifiedUser,
                    contentDescription = null
                )
                Spacer(Modifier.width(8.dp))
                Text(L10n.text(locale, if (challenge == null) "continue" else "verify"))
            }
        }

        if (challenge != null) {
            TextButton(
                onClick = { otpCode = ""; onCancelChallenge() },
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text(L10n.text(locale, "cancel"))
            }
        }

        OutlinedButton(
            onClick = onOpenPublicMap,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("auth_public_map_button")
        ) {
            Icon(Icons.Outlined.Public, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(L10n.text(locale, "publicMap"))
        }
    }
}
