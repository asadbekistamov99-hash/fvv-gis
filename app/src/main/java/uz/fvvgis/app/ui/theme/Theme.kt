package uz.fvvgis.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import uz.fvvgis.app.R

val NotoSansFamily = FontFamily(Font(R.font.noto_sans, FontWeight.Normal))
val SpaceGroteskFamily = FontFamily(Font(R.font.space_grotesk, FontWeight.Normal))

object GisColors {
    val CyanAccent = Color(0xFF5DE6F5)
    val DeepTeal = Color(0xFF006879)
    val MidnightBg = Color(0xFF081320)
    val MidnightCard = Color(0xFF102136)
    val MidnightElevated = Color(0xFF172D47)
    val LightBg = Color(0xFFF0F4F8)
    val LightCard = Color(0xFFFFFFFF)
    val LightInk = Color(0xFF102136)

    val StatusWorking = Color(0xFF36D698)
    val StatusFaulty = Color(0xFFFF8A91)
    val StatusMaintenance = Color(0xFFFFCD73)
    val StatusUnknown = Color(0xFF9EB4CC)
    val OfflineBanner = Color(0xFF6B4100)
}

fun statusColor(value: String): Color = when (value) {
    "working", "approved", "published", "resolved" -> GisColors.StatusWorking
    "faulty", "rejected" -> GisColors.StatusFaulty
    "under_maintenance", "requires_correction", "submitted", "in_progress", "pending", "queued_offline" -> GisColors.StatusMaintenance
    else -> GisColors.StatusUnknown
}

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF5DE6F5),
    onPrimary = Color(0xFF00363F),
    primaryContainer = Color(0xFF0E3A4A),
    onPrimaryContainer = Color(0xFFB5F2FA),
    secondary = Color(0xFF36D698),
    onSecondary = Color(0xFF003824),
    secondaryContainer = Color(0xFF123B32),
    onSecondaryContainer = Color(0xFFB4F7DA),
    tertiary = Color(0xFFFFCD73),
    onTertiary = Color(0xFF3E2900),
    tertiaryContainer = Color(0xFF4B3712),
    onTertiaryContainer = Color(0xFFFFE5B4),
    background = GisColors.MidnightBg,
    onBackground = Color(0xFFF5F9FF),
    surface = GisColors.MidnightCard,
    onSurface = Color(0xFFF5F9FF),
    surfaceVariant = GisColors.MidnightElevated,
    onSurfaceVariant = Color(0xFFB6CCE3),
    outline = Color(0xFF39516B),
    error = Color(0xFFFF8A91),
    onError = Color(0xFF4E0811),
    errorContainer = Color(0xFF5D171E),
    onErrorContainer = Color(0xFFFFDADF)
)

private val LightColorScheme = lightColorScheme(
    primary = GisColors.DeepTeal,
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFBDEEFF),
    onPrimaryContainer = Color(0xFF002026),
    secondary = Color(0xFF107A56),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFC2F5E0),
    onSecondaryContainer = Color(0xFF002B1C),
    tertiary = Color(0xFF8C5A00),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFE4B8),
    onTertiaryContainer = Color(0xFF2D1B00),
    background = GisColors.LightBg,
    onBackground = GisColors.LightInk,
    surface = GisColors.LightCard,
    onSurface = GisColors.LightInk,
    surfaceVariant = Color(0xFFE1EAEF),
    onSurfaceVariant = Color(0xFF3D5368),
    outline = Color(0xFFA5B4C4),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002)
)

val AppTypography = Typography(
    displayLarge = TextStyle(fontFamily = SpaceGroteskFamily, fontWeight = FontWeight.Bold, fontSize = 36.sp, lineHeight = 42.sp),
    headlineLarge = TextStyle(fontFamily = SpaceGroteskFamily, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp),
    headlineMedium = TextStyle(fontFamily = SpaceGroteskFamily, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp),
    headlineSmall = TextStyle(fontFamily = SpaceGroteskFamily, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
    titleLarge = TextStyle(fontFamily = SpaceGroteskFamily, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = NotoSansFamily, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp)
)

val AppShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp)
)

@Composable
fun FvvGisTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content
    )
}
