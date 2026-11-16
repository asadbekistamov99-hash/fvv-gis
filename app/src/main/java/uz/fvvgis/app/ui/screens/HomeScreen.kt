package uz.fvvgis.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import uz.fvvgis.app.R
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.L10n
import uz.fvvgis.app.ui.components.SectionCard
import uz.fvvgis.app.ui.components.dialPhone
import uz.fvvgis.app.ui.components.openExternalUrl
import uz.fvvgis.app.ui.theme.GisColors
import uz.fvvgis.app.ui.viewmodel.MainUiState

@Composable
fun HomeScreen(
    state: MainUiState,
    onOpenMap: () -> Unit,
    onOpenReport: () -> Unit,
    onOpenMyReports: () -> Unit,
    onOpenAuth: () -> Unit
) {
    val context = LocalContext.current
    val locale = state.locale

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .border(1.dp, Color(0xFF327B91), RoundedCornerShape(24.dp))
        ) {
            Image(
                painter = painterResource(id = R.drawable.img_gis_hero),
                contentDescription = stringResource(R.string.content_desc_hero_banner),
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize()
            )
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0xCC0D2538),
                                Color(0xE6102136)
                            )
                        )
                    )
            )
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Public,
                        contentDescription = null,
                        tint = GisColors.CyanAccent
                    )
                    Text(
                        text = "UZBEKISTAN",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = androidx.compose.ui.unit.TextUnit(2f, androidx.compose.ui.unit.TextUnitType.Sp)
                        ),
                        color = GisColors.CyanAccent
                    )
                }
                Text(
                    text = state.account?.fullName ?: "FVV GIS",
                    style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.Black),
                    color = Color.White
                )
                Text(
                    text = L10n.text(locale, "independent"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.9f)
                )
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = onOpenMap,
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .testTag("home_public_map_button")
                ) {
                    Icon(Icons.Outlined.Map, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(L10n.text(locale, "publicMap"))
                }
            }
        }

        SectionCard {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.Emergency,
                    contentDescription = null,
                    tint = GisColors.StatusFaulty,
                    modifier = Modifier.size(32.dp)
                )
                Text(
                    text = L10n.text(locale, "emergencyNotice"),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(16.dp))
            OutlinedButton(
                onClick = { dialPhone(context, "112") },
                modifier = Modifier
                    .fillMaxWidth()
                    .minimumInteractiveComponentSize()
                    .testTag("dial_112_button")
            ) {
                Icon(Icons.Outlined.Phone, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("112")
            }
        }

        Button(
            onClick = { if (state.account == null) onOpenAuth() else onOpenReport() },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("home_new_report_button")
        ) {
            Icon(Icons.Outlined.AddAlert, contentDescription = null)
            Spacer(Modifier.width(10.dp))
            Text(L10n.text(locale, "newReport"))
        }

        OutlinedButton(
            onClick = { if (state.account == null) onOpenAuth() else onOpenMyReports() },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("home_my_reports_button")
        ) {
            Icon(Icons.Outlined.Assignment, contentDescription = null)
            Spacer(Modifier.width(10.dp))
            Text(L10n.text(locale, "reports"))
        }

        SectionCard(
            title = L10n.pick(locale, "Shoshilinch xizmatlar", "Экстренные номера", "Emergency contacts")
        ) {
            val contacts = listOf(
                "112" to L10n.pick(locale, "Yagona shoshilinch xizmat", "Единая экстренная служба", "Unified emergency service"),
                "101" to L10n.pick(locale, "Yong‘in va qutqaruv", "Пожарная и спасательная служба", "Fire and rescue"),
                "102" to L10n.pick(locale, "Ichki ishlar", "Полиция", "Police"),
                "103" to L10n.pick(locale, "Tez tibbiy yordam", "Скорая помощь", "Ambulance"),
                "104" to L10n.pick(locale, "Gaz avariya xizmati", "Газовая аварийная служба", "Gas emergency")
            )
            contacts.forEachIndexed { idx, (number, label) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f).padding(end = 12.dp)
                    )
                    OutlinedButton(
                        onClick = { dialPhone(context, number) },
                        modifier = Modifier
                            .minimumInteractiveComponentSize()
                            .testTag("dial_${number}_button")
                    ) {
                        Text(number, fontWeight = FontWeight.Bold)
                    }
                }
                if (idx < contacts.lastIndex) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(
                onClick = { openExternalUrl(context, "https://advice.adliya.uz/oz/document/3256") },
                modifier = Modifier.testTag("adliya_source_link")
            ) {
                Text(
                    when (locale) {
                        AppLocale.EN -> "Source: Ministry of Justice"
                        AppLocale.RU -> "Источник: Министерство юстиции"
                        AppLocale.UZ -> "Manba: Adliya vazirligi"
                    }
                )
            }
        }
    }
}
