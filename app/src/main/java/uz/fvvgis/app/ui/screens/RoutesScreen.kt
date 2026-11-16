package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.core.ParsedGeometry
import uz.fvvgis.app.data.local.ApprovedRouteEntity
import uz.fvvgis.app.data.local.RegionEntity
import uz.fvvgis.app.ui.components.*
import uz.fvvgis.app.ui.viewmodel.MainUiState
import kotlin.math.ceil

@Composable
fun ApprovedRoutesScreen(
    state: MainUiState,
    routes: List<ApprovedRouteEntity>,
    regions: List<RegionEntity>,
    onApproveRoute: (String) -> Unit,
    onWithdrawRoute: (String) -> Unit
) {
    val locale = state.locale
    if (!state.isEmployee) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(L10n.text(locale, "pendingVerification"), modifier = Modifier.padding(24.dp))
        }
        return
    }

    var selectedRouteId by remember { mutableStateOf(routes.firstOrNull()?.id) }
    val selectedRoute = routes.firstOrNull { it.id == selectedRouteId } ?: routes.firstOrNull()
    var navigating by remember { mutableStateOf(false) }
    var currentStepIdx by remember { mutableIntStateOf(0) }
    var userGps by remember { mutableStateOf<GeoPoint?>(null) }
    var navError by remember { mutableStateOf<String?>(null) }

    val routePoints = remember(selectedRoute?.geometryJson) {
        selectedRoute?.let {
            (GeoUtils.parseGeoJson(it.geometryJson) as? ParsedGeometry.LineString)?.points
        }.orEmpty()
    }

    val routeSteps = remember(selectedRoute?.stepsJson) {
        selectedRoute?.let {
            runCatching {
                Json.parseToJsonElement(it.stepsJson).jsonArray.map { el -> el.jsonObject }
            }.getOrDefault(emptyList())
        }.orEmpty()
    }

    val initialViewport = remember(routePoints) {
        routePoints.firstOrNull()?.let { MapViewport(it.lat, it.lon, zoom = 14f) } ?: MapViewport()
    }
    var viewport by remember(selectedRoute?.id) { mutableStateOf(initialViewport) }

    val requestStartNav = rememberLocationRequester { fix, _ ->
        val route = selectedRoute ?: return@rememberLocationRequester
        if (!state.isLeaseValid || route.status != "approved" || (route.expiresAtEpochMs ?: 0L) <= state.currentTimeMs) {
            navError = L10n.pick(
                locale,
                "Tasdiq, manba sanasi va amaldagi offline ruxsat talab qilinadi.",
                "Нужны одобрение, дата источника и действующий офлайн-доступ.",
                "Approval, a source date and a valid offline grant are required."
            )
            return@rememberLocationRequester
        }
        userGps = fix?.point ?: routePoints.firstOrNull()
        navError = null
        navigating = true
        currentStepIdx = 0
    }

    fun formatDist(m: Double): String = if (m < 1000) "${m.toInt()} m" else "${"%.1f".format(m / 1000.0)} km"

    fun stepInstruction(stepObj: JsonObject): String {
        val maneuver = stepObj["maneuver"]?.jsonObject
        val type = maneuver?.get("type")?.jsonPrimitive?.contentOrNull
        val mod = maneuver?.get("modifier")?.jsonPrimitive?.contentOrNull ?: ""
        val dir = when {
            mod.contains("right") -> L10n.pick(locale, "o‘ngga", "направо", "right")
            mod.contains("left") -> L10n.pick(locale, "chapga", "налево", "left")
            else -> L10n.pick(locale, "to‘g‘riga", "прямо", "straight")
        }
        val action = when (type) {
            "arrive" -> L10n.pick(locale, "Manzilga yetib kelish", "Прибытие к месту назначения", "Arrive at destination")
            "depart" -> L10n.pick(locale, "Tasdiqlangan yo‘ldan boshlang", "Начните движение по одобренному пути", "Start along the approved route")
            "turn" -> L10n.pick(locale, "Buriling: ", "Поверните: ", "Turn: ") + dir
            else -> L10n.pick(locale, "Davom eting: ", "Продолжайте: ", "Continue: ") + dir
        }
        val street = stepObj["name"]?.jsonPrimitive?.contentOrNull.orEmpty()
        return if (street.isEmpty()) action else "$action · $street"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = L10n.text(locale, "route"),
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black)
        )
        Text(
            text = L10n.pick(
                locale,
                "Oddiy yo‘l ma’lumotlari. Marshrut favqulodda harakat uchun yaroqlilik kafolati emas.",
                "Обычные дорожные данные. Маршрут не гарантирует пригодность для экстренного движения.",
                "Ordinary road data. This route does not guarantee suitability for emergency response."
            ),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (navError != null) {
            SectionCard {
                Text(navError!!, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
            }
        }

        if (routes.isEmpty()) {
            EmptyPanel(locale = locale, icon = Icons.Outlined.Route)
        } else {
            routes.forEach { item ->
                val isSelected = item.id == selectedRoute?.id
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            navigating = false
                            selectedRouteId = item.id
                        },
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                        else MaterialTheme.colorScheme.surface
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = if (item.status == "approved") Icons.Outlined.Verified else Icons.Outlined.Pending,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.destinationName,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Text(
                                text = "${formatDist(item.distanceM)} · ${ceil(item.durationS / 60.0).toInt()} min",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(Modifier.height(6.dp))
                            StatusPill(item.status, locale)
                        }
                        Icon(Icons.Outlined.ChevronRight, contentDescription = null)
                    }
                }
            }
        }

        selectedRoute?.let { route ->
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
                    viewport = viewport,
                    onViewportChange = { viewport = it },
                    routePoints = routePoints,
                    userLocation = userGps
                )
            }

            SectionCard {
                DataRowView(L10n.text(locale, "status"), L10n.text(locale, route.status))
                DataRowView(L10n.pick(locale, "Yo‘l ma’lumotlari sanasi", "Дата дорожных данных", "Road data date"), route.sourceDate)
                DataRowView(L10n.pick(locale, "Tasdiqlagan rahbar", "Одобривший руководитель", "Approving supervisor"), route.approvedBy)
                DataRowView(L10n.text(locale, "permission"), if (state.isLeaseValid) "${state.leaseRemainingMinutes} min" else "—")
            }

            if (navigating && routeSteps.isNotEmpty()) {
                val active = routeSteps[currentStepIdx.coerceIn(0, routeSteps.lastIndex)]
                SectionCard(title = stepInstruction(active)) {
                    val dist = active["distance_m"]?.jsonPrimitive?.doubleOrNull ?: 0.0
                    DataRowView(
                        L10n.pick(locale, "Keyingi amalga taxminan", "До следующего манёвра", "Next maneuver"),
                        "≈ ${formatDist(dist)}"
                    )
                    Text(
                        text = L10n.pick(
                            locale,
                            "Masofa GPS bo‘yicha taxminiy; yo‘l belgilariga rioya qiling.",
                            "GPS-расстояние приблизительное; соблюдайте дорожные знаки.",
                            "GPS distance is approximate; obey road signs."
                        ),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(Modifier.height(10.dp))
                    if (currentStepIdx < routeSteps.lastIndex) {
                        OutlinedButton(onClick = { currentStepIdx++ }) {
                            Text(L10n.text(locale, "continue"))
                        }
                    }
                }
            }

            if (state.account?.canApproveRoutes == true && route.status == "pending") {
                Button(
                    onClick = { onApproveRoute(route.id) },
                    modifier = Modifier.fillMaxWidth().height(52.dp).testTag("route_approve_button")
                ) {
                    Icon(Icons.Outlined.Verified, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(L10n.text(locale, "approved"))
                }
            } else if (state.account?.canApproveRoutes == true && route.status == "approved") {
                OutlinedButton(
                    onClick = {
                        navigating = false
                        onWithdrawRoute(route.id)
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text(L10n.pick(locale, "Tasdiqni bekor qilish", "Отозвать одобрение", "Withdraw approval"))
                }
            }

            Button(
                enabled = route.status == "approved",
                onClick = {
                    if (navigating) navigating = false else requestStartNav()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("route_nav_button")
            ) {
                Icon(
                    imageVector = if (navigating) Icons.Outlined.StopCircle else Icons.Outlined.Navigation,
                    contentDescription = null
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    if (navigating) L10n.pick(locale, "Navigatsiyani to‘xtatish", "Остановить навигацию", "Stop navigation")
                    else L10n.pick(locale, "Tasdiqlangan yo‘ldan boshlash", "Начать по одобренному пути", "Start approved navigation")
                )
            }
        }
    }
}
