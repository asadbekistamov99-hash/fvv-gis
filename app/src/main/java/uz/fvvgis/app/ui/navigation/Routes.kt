package uz.fvvgis.app.ui.navigation

import kotlinx.serialization.Serializable

@Serializable data object HomeRoute
@Serializable data object MapRoute
@Serializable data object RegistryRoute
@Serializable data class ObjectFormRoute(val objectId: String? = null)
@Serializable data class PassportRoute(val objectId: String)
@Serializable data object ReportRoute
@Serializable data object MyReportsRoute
@Serializable data object InspectionsRoute
@Serializable data object RoutesRoute
@Serializable data object SyncRoute
@Serializable data object NotificationsRoute
@Serializable data object ProfileRoute
@Serializable data object AuthRoute
