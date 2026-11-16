package uz.fvvgis.app.ui.components

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import uz.fvvgis.app.core.AppLocale
import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.L10n

data class LocationFix(val point: GeoPoint, val accuracyMeters: Double)

enum class LocationPermissionLevel {
    DENIED,
    APPROXIMATE_ONLY,
    PRECISE_GRANTED
}

fun checkLocationPermissionLevel(context: Context): LocationPermissionLevel {
    val hasFine = ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    if (hasFine) return LocationPermissionLevel.PRECISE_GRANTED
    val hasCoarse = ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return if (hasCoarse) LocationPermissionLevel.APPROXIMATE_ONLY else LocationPermissionLevel.DENIED
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

fun openAppLocationSettings(context: Context) {
    val intent = Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.fromParts("package", context.packageName, null)
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}

@SuppressLint("MissingPermission")
fun readBestDeviceLocation(context: Context): LocationFix? {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
    var best: Location? = null
    for (p in providers) {
        if (runCatching { lm.isProviderEnabled(p) }.getOrDefault(false)) {
            val loc = runCatching { lm.getLastKnownLocation(p) }.getOrNull()
            if (loc != null && (best == null || loc.accuracy < best.accuracy)) {
                best = loc
            }
        }
    }
    return best?.let { LocationFix(GeoPoint(it.latitude, it.longitude), it.accuracy.toDouble()) }
}

@Composable
fun rememberLocationRequester(
    onResult: (LocationFix?, String?) -> Unit
): () -> Unit {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (!granted) {
            onResult(null, "Joylashuvga ruxsat berilmadi. Joyni xaritadan tanlang.")
        } else {
            val fix = readBestDeviceLocation(context)
            if (fix != null) {
                onResult(fix, null)
            } else {
                // Fallback to Tashkent reference if emulator has no mock GPS fix yet
                onResult(
                    LocationFix(GeoPoint(41.2995, 69.2401), 15.0),
                    "GPS signali topilmadi; Toshkent markazi (41.2995, 69.2401) qo‘llandi."
                )
            }
        }
    }

    return remember(context, launcher) {
        {
            val level = checkLocationPermissionLevel(context)
            if (level != LocationPermissionLevel.DENIED) {
                val fix = readBestDeviceLocation(context)
                if (fix != null) {
                    onResult(fix, null)
                } else {
                    onResult(
                        LocationFix(GeoPoint(41.2995, 69.2401), 15.0),
                        "GPS signali topilmadi; Toshkent markazi (41.2995, 69.2401) qo‘llandi."
                    )
                }
            } else {
                launcher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }
    }
}

/**
 * Streams foreground GPS/network location fixes while [enabled] is true and
 * location permission is granted, cleanly unregistering on dispose.
 */
@SuppressLint("MissingPermission")
@Composable
fun LiveLocationUpdatesEffect(
    enabled: Boolean,
    permissionLevel: LocationPermissionLevel,
    onLocationFix: (LocationFix, Boolean) -> Unit
) {
    val context = LocalContext.current
    val currentOnFix by rememberUpdatedState(onLocationFix)

    DisposableEffect(context, enabled, permissionLevel) {
        if (!enabled || permissionLevel == LocationPermissionLevel.DENIED) {
            return@DisposableEffect onDispose {}
        }

        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val initialFix = readBestDeviceLocation(context)
        if (initialFix != null) {
            currentOnFix(initialFix, false)
        } else {
            currentOnFix(LocationFix(GeoPoint(41.2995, 69.2401), 15.0), true)
        }

        if (lm == null) {
            return@DisposableEffect onDispose {}
        }

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentOnFix(
                    LocationFix(GeoPoint(location.latitude, location.longitude), location.accuracy.toDouble()),
                    false
                )
            }

            @Deprecated("Deprecated in Android API")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
            override fun onProviderEnabled(provider: String) = Unit
            override fun onProviderDisabled(provider: String) = Unit
        }

        val activeProviders = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { p -> runCatching { lm.isProviderEnabled(p) }.getOrDefault(false) }

        activeProviders.forEach { provider ->
            runCatching {
                lm.requestLocationUpdates(provider, 2000L, 3f, listener, Looper.getMainLooper())
            }
        }

        onDispose {
            runCatching { lm.removeUpdates(listener) }
        }
    }
}

data class LocationTrackingController(
    val permissionLevel: LocationPermissionLevel,
    val requestTrackingStart: () -> Unit,
    val dialogContent: @Composable () -> Unit
)

@Composable
fun rememberLocationTrackingController(
    locale: AppLocale,
    onPermissionGranted: (LocationPermissionLevel) -> Unit,
    onPermissionDeniedMessage: (String) -> Unit
): LocationTrackingController {
    val context = LocalContext.current
    var permissionLevel by remember { mutableStateOf(checkLocationPermissionLevel(context)) }
    var showRationaleDialog by remember { mutableStateOf(false) }
    var showSettingsFallback by remember { mutableStateOf(false) }
    var hasRequestedOnce by remember { mutableStateOf(false) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val fine = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarse = grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        val newLevel = when {
            fine -> LocationPermissionLevel.PRECISE_GRANTED
            coarse -> LocationPermissionLevel.APPROXIMATE_ONLY
            else -> LocationPermissionLevel.DENIED
        }
        permissionLevel = newLevel
        when (newLevel) {
            LocationPermissionLevel.PRECISE_GRANTED -> {
                showRationaleDialog = false
                showSettingsFallback = false
                onPermissionGranted(newLevel)
            }
            LocationPermissionLevel.APPROXIMATE_ONLY -> {
                onPermissionGranted(newLevel)
                onPermissionDeniedMessage(L10n.text(locale, "locationPermissionApproximateHint"))
            }
            LocationPermissionLevel.DENIED -> {
                val activity = context.findActivity()
                val shouldShowRationale = activity != null &&
                    ActivityCompat.shouldShowRequestPermissionRationale(
                        activity,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    )
                if (!shouldShowRationale && hasRequestedOnce) {
                    showSettingsFallback = true
                    showRationaleDialog = true
                } else {
                    onPermissionDeniedMessage(L10n.text(locale, "locationPermissionDeniedPermanent"))
                }
            }
        }
    }

    val requestTrackingStart: () -> Unit = remember(context, launcher) {
        {
            val current = checkLocationPermissionLevel(context)
            permissionLevel = current
            when (current) {
                LocationPermissionLevel.PRECISE_GRANTED -> {
                    onPermissionGranted(current)
                }
                LocationPermissionLevel.APPROXIMATE_ONLY,
                LocationPermissionLevel.DENIED -> {
                    showSettingsFallback = false
                    showRationaleDialog = true
                }
            }
        }
    }

    val dialogContent: @Composable () -> Unit = {
        if (showRationaleDialog) {
            val messageKey = when {
                showSettingsFallback -> "locationPermissionDeniedPermanent"
                permissionLevel == LocationPermissionLevel.APPROXIMATE_ONLY -> "locationPermissionApproximateHint"
                else -> "locationPermissionRationale"
            }
            AlertDialog(
                onDismissRequest = { showRationaleDialog = false },
                icon = {
                    Icon(
                        imageVector = Icons.Outlined.MyLocation,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                },
                title = { Text(L10n.text(locale, "locationPermissionTitle")) },
                text = { Text(L10n.text(locale, messageKey)) },
                confirmButton = {
                    Button(
                        onClick = {
                            if (showSettingsFallback) {
                                showRationaleDialog = false
                                openAppLocationSettings(context)
                            } else {
                                showRationaleDialog = false
                                hasRequestedOnce = true
                                launcher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            }
                        },
                        modifier = Modifier.testTag("location_permission_confirm_button")
                    ) {
                        Text(
                            L10n.text(
                                locale,
                                if (showSettingsFallback) "openSettings" else "allowPreciseLocation"
                            )
                        )
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = {
                            showRationaleDialog = false
                            if (permissionLevel == LocationPermissionLevel.APPROXIMATE_ONLY) {
                                onPermissionGranted(LocationPermissionLevel.APPROXIMATE_ONLY)
                            }
                        },
                        modifier = Modifier.testTag("location_permission_cancel_button")
                    ) {
                        Text(L10n.text(locale, "cancel"))
                    }
                }
            )
        }
    }

    return LocationTrackingController(
        permissionLevel = permissionLevel,
        requestTrackingStart = requestTrackingStart,
        dialogContent = dialogContent
    )
}
