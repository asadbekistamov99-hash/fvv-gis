package uz.fvvgis.app.data.local

import uz.fvvgis.app.core.GeoPoint
import uz.fvvgis.app.core.GeoUtils
import java.text.SimpleDateFormat
import java.util.*

object SeedData {
    private fun isoUtcDaysAgo(daysAgo: Int): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.add(Calendar.DAY_OF_YEAR, -daysAgo)
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(cal.time)
    }

    val regions = listOf(
        RegionEntity("UZ-AN", "Andijon viloyati", "Андижанская область", "Andijan", 40.782, 72.344),
        RegionEntity("UZ-BU", "Buxoro viloyati", "Бухарская область", "Bukhara", 39.775, 64.421),
        RegionEntity("UZ-FA", "Farg‘ona viloyati", "Ферганская область", "Fergana", 40.386, 71.786),
        RegionEntity("UZ-JI", "Jizzax viloyati", "Джизакская область", "Jizzakh", 40.115, 67.840),
        RegionEntity("UZ-NG", "Namangan viloyati", "Наманганская область", "Namangan", 40.998, 71.673),
        RegionEntity("UZ-NW", "Navoiy viloyati", "Навоийская область", "Navoi", 40.103, 65.379),
        RegionEntity("UZ-QA", "Qashqadaryo viloyati", "Кашкадарьинская область", "Kashkadarya", 38.861, 65.788),
        RegionEntity("UZ-QR", "Qoraqalpog‘iston Respublikasi", "Республика Каракалпакстан", "Karakalpakstan", 42.460, 59.610),
        RegionEntity("UZ-SA", "Samarqand viloyati", "Самаркандская область", "Samarkand", 39.660, 66.974),
        RegionEntity("UZ-SI", "Sirdaryo viloyati", "Сырдарьинская область", "Sirdarya", 40.489, 68.770),
        RegionEntity("UZ-SU", "Surxondaryo viloyati", "Сурхандарьинская область", "Surkhandarya", 37.224, 67.278),
        RegionEntity("UZ-TK", "Toshkent shahri", "Город Ташкент", "Tashkent city", 41.299, 69.240),
        RegionEntity("UZ-TO", "Toshkent viloyati", "Ташкентская область", "Tashkent region", 41.450, 69.380),
        RegionEntity("UZ-XO", "Xorazm viloyati", "Хорезмская область", "Khorezm", 41.553, 60.630)
    )

    val categories = listOf(
        CategoryEntity("fire_hydrant", "Yong‘in gidrantlari", "Пожарные гидранты", "Fire hydrants", "Point", "fire_hydrant_alt", "#FFB547"),
        CategoryEntity("water_pipeline", "Ichimlik suvi quvurlari", "Водопроводы", "Drinking-water pipelines", "LineString", "water", "#30CCF2"),
        CategoryEntity("water_network", "Suv taqsimlash tarmoqlari", "Водораспределительные сети", "Water distribution networks", "LineString", "hub", "#40BDF8"),
        CategoryEntity("reservoir", "Suv omborlari", "Водохранилища", "Water reservoirs", "Polygon", "waves", "#38BDF8"),
        CategoryEntity("pumping_station", "Nasos stansiyalari", "Насосные станции", "Pumping stations", "Point,Polygon", "settings", "#56D7C7"),
        CategoryEntity("sewer_pipeline", "Kanalizatsiya quvurlari", "Канализационные трубы", "Sewer pipelines", "LineString", "route", "#A78BFA"),
        CategoryEntity("sewer_manhole", "Kanalizatsiya quduqlari", "Канализационные колодцы", "Sewer manholes", "Point", "circle", "#A78BFA"),
        CategoryEntity("drainage", "Drenaj tizimlari", "Дренажные системы", "Drainage systems", "Point,LineString,Polygon", "water_drop", "#87BAC5"),
        CategoryEntity("gas_pipeline", "Gaz quvurlari", "Газопроводы", "Gas pipelines", "LineString", "local_fire_department", "#F7CA59"),
        CategoryEntity("gas_valve", "Gaz boshqaruv klapanlari", "Газовые клапаны", "Gas control valves", "Point", "tune", "#F7CA59"),
        CategoryEntity("electrical_cable", "Elektr kabellari", "Электрические кабели", "Electrical cables", "LineString", "bolt", "#FDBA74"),
        CategoryEntity("substation", "Elektr podstansiyalari", "Подстанции", "Electrical substations", "Point,Polygon", "electrical_services", "#FDBA74"),
        CategoryEntity("telecommunications", "Telekommunikatsiya infratuzilmasi", "Телекоммуникации", "Telecommunications", "Point,LineString,Polygon", "cell_tower", "#C4B5FD"),
        CategoryEntity("heating_network", "Issiqlik tarmoqlari", "Тепловые сети", "Heating networks", "LineString", "thermostat", "#FB7185"),
        CategoryEntity("emergency_water_source", "Favqulodda suv manbalari", "Аварийные источники воды", "Emergency water sources", "Point,Polygon", "water_drop", "#34D399"),
        CategoryEntity("other", "Boshqa ruxsatli infratuzilma", "Прочая инфраструктура", "Other authorized infrastructure", "Point,LineString,Polygon", "location_on", "#94A3B8")
    )

    val demoAccounts = listOf(
        UserAccountEntity("acc-citizen-1", "+998900000001", "Demo fuqaro", "citizen", "none", "org-demo", "UZ-TK", "DEMO-UZ-TK"),
        UserAccountEntity("acc-emp-1", "+998900000011", "Demo xodim A", "verified_employee", "verified", "org-demo", "UZ-TK", "DEMO-UZ-TK", department = "Operativ guruh"),
        UserAccountEntity("acc-emp-2", "+998900000012", "Demo xodim B", "verified_employee", "verified", "org-demo", "UZ-SA", "DEMO-UZ-SA", department = "Gidrant nazorati"),
        UserAccountEntity("acc-emp-3", "+998900000013", "Demo xodim C", "infrastructure_inspector", "verified", "org-demo", "UZ-BU", "DEMO-UZ-BU", department = "Texnik tekshiruv"),
        UserAccountEntity("acc-reviewer", "+998900000021", "Demo ma’lumot tekshiruvchisi", "data_reviewer", "verified", "org-demo", "UZ-TK", "DEMO-UZ-TK", department = "Ma’lumotlar nazorati"),
        UserAccountEntity("acc-supervisor", "+998900000031", "Demo hudud rahbari", "regional_supervisor", "verified", "org-demo", "UZ-TK", "DEMO-UZ-TK", department = "Hududiy boshqarma"),
        UserAccountEntity("acc-admin", "+998900000099", "Demo administrator", "system_administrator", "verified", "org-demo", "UZ-TK", "DEMO-UZ-TK", department = "Tizim ma’muriyati")
    )

    val demoOrganizations = listOf(
        "org-demo" to "SINTETIK DEMO — mustaqil GIS sinov jamoasi",
        "org-water" to "SINTETIK DEMO — Suv ta’minoti sinov bo‘limi"
    )

    private val statuses = listOf(
        "working",
        "faulty",
        "under_maintenance",
        "temporarily_unavailable",
        "not_inspected",
        "unknown"
    )

    fun createDemoObjects(): List<InfrastructureObjectEntity> {
        return (0 until 30).map { i ->
            val region = regions[i % regions.size]
            val category = categories[i % categories.size]
            val offset = (i / 14 + 1) * 0.014
            val lat = (region.centerLat + offset)
            val lon = (region.centerLon + offset)
            val primaryType = category.geometryTypesCsv.split(",").first()
            val geometryJson = when (primaryType) {
                "LineString" -> GeoUtils.encodeGeoJson(
                    "LineString",
                    listOf(GeoPoint(lat, lon), GeoPoint(lat + 0.045, lon + 0.075))
                )
                "Polygon" -> GeoUtils.encodeGeoJson(
                    "Polygon",
                    listOf(
                        GeoPoint(lat, lon),
                        GeoPoint(lat, lon + 0.06),
                        GeoPoint(lat + 0.05, lon + 0.06),
                        GeoPoint(lat + 0.05, lon)
                    )
                )
                else -> GeoUtils.encodeGeoJson("Point", listOf(GeoPoint(lat, lon)))
            }
            val measuredAt = isoUtcDaysAgo(3 + i)
            val passportJson = when (category.id) {
                "fire_hydrant" -> """{"schema_version":1,"hydrant_type":"demo","installation_type":"above_ground","connection_diameter_mm":100,"nominal_pressure_kpa":400.0,"measured_pressure_kpa":320.0,"flow_lps":12.5,"measurement_date":"$measuredAt","measurement_method":"synthetic_demo","accessibility_status":"open","notes":"SINTETIK DEMO: haqiqiy infratuzilma emas"}"""
                "water_pipeline", "water_network", "reservoir", "pumping_station" -> """{"schema_version":1,"diameter_mm":250,"material":"steel_demo","length_m":420,"pressure_kpa":380.0,"capacity_m3":1200,"notes":"SINTETIK DEMO: haqiqiy infratuzilma emas"}"""
                "electrical_cable", "substation" -> """{"schema_version":1,"voltage_kv":10.0,"cable_type":"demo_armored","installation_method":"underground","notes":"SINTETIK DEMO: haqiqiy infratuzilma emas"}"""
                "gas_pipeline", "gas_valve" -> """{"schema_version":1,"diameter_mm":150,"material":"polyethylene_demo","classification":"medium_pressure","notes":"SINTETIK DEMO: haqiqiy infratuzilma emas"}"""
                else -> """{"schema_version":1,"material":"demo_composite","notes":"SINTETIK DEMO: haqiqiy infratuzilma emas"}"""
            }
            val isPublic = category.id == "emergency_water_source" || i % 5 == 0
            val lifecycle = if (i == 28 || i == 29) "submitted" else "published"
            InfrastructureObjectEntity(
                id = "demo-obj-${i + 1}",
                code = "DEMO-UZ-${(i + 1).toString().padStart(4, '0')}",
                name = "SINTETIK DEMO — ${category.nameUz} ${(i + 1).toString().padStart(2, '0')}",
                description = "Faqat dastur sinovi uchun yaratilgan. Joylashuv haqiqiy infratuzilmani ko‘rsatmaydi.",
                categoryId = category.id,
                regionId = region.id,
                districtId = "DEMO-${region.id}",
                geometryJson = geometryJson,
                operationalStatus = statuses[i % statuses.size],
                lifecycle = lifecycle,
                sensitivity = "internal",
                version = 1,
                passportJson = passportJson,
                accuracyM = 4.5,
                updatedAt = isoUtcDaysAgo(i % 10),
                isSynthetic = true,
                isPublicProjected = isPublic
            )
        }
    }

    fun createDemoInspections(): List<InspectionEntity> = listOf(
        InspectionEntity(
            id = "insp-demo-1",
            objectId = "demo-obj-1",
            inspectorName = "Demo xodim A",
            condition = "good",
            operationalStatus = "working",
            notes = "SINTETIK DEMO: Gidrant bosimi me’yorda (320 kPa), kirish yo‘li ochiq.",
            nextInspectionDate = "2026-12-15",
            createdAt = isoUtcDaysAgo(3)
        ),
        InspectionEntity(
            id = "insp-demo-2",
            objectId = "demo-obj-17",
            inspectorName = "Demo xodim B",
            condition = "fair",
            operationalStatus = "under_maintenance",
            notes = "SINTETIK DEMO: Klapan muhri reja asosida almashtirilmoqda.",
            nextInspectionDate = "2026-11-30",
            createdAt = isoUtcDaysAgo(1)
        )
    )

    fun createDemoReports(): List<CitizenReportEntity> = listOf(
        CitizenReportEntity(
            id = "rep-demo-1",
            userId = "acc-citizen-1",
            category = "infrastructure_fault",
            description = "SINTETIK DEMO — Tashkent hududida sinov gidranti qopqog‘i shikastlangan (shoshilinch emas).",
            regionId = "UZ-TK",
            geometryJson = GeoUtils.encodeGeoJson("Point", listOf(GeoPoint(41.311, 69.279))),
            contactPhone = "+998900000001",
            status = "in_progress",
            resolution = null,
            attachmentCount = 0,
            isSynthetic = true,
            createdAt = isoUtcDaysAgo(4),
            updatedAt = isoUtcDaysAgo(1)
        )
    )

    fun createDemoRoutes(): List<ApprovedRouteEntity> {
        val nowMs = System.currentTimeMillis()
        val routeGeom1 = GeoUtils.encodeGeoJson(
            "LineString",
            listOf(
                GeoPoint(41.2995, 69.2401),
                GeoPoint(41.3050, 69.2480),
                GeoPoint(41.3105, 69.2540),
                GeoPoint(41.3130, 69.2540)
            )
        )
        val steps1 = """[
            {"name":"Amir Temur shoh ko‘chasi","distance_m":680,"duration_s":75,"maneuver":{"type":"depart","modifier":"straight","location":[69.2401,41.2995]}},
            {"name":"Navoiy ko‘chasi","distance_m":740,"duration_s":85,"maneuver":{"type":"turn","modifier":"right","location":[69.2480,41.3050]}},
            {"name":"DEMO-UZ-0001 manzili","distance_m":310,"duration_s":40,"maneuver":{"type":"arrive","modifier":"straight","location":[69.2540,41.3130]}}
        ]"""

        val routeGeom2 = GeoUtils.encodeGeoJson(
            "LineString",
            listOf(
                GeoPoint(39.6542, 66.9597),
                GeoPoint(39.6620, 66.9700),
                GeoPoint(39.6740, 66.9880)
            )
        )
        val steps2 = """[
            {"name":"Registon ko‘chasi","distance_m":1150,"duration_s":130,"maneuver":{"type":"depart","modifier":"straight","location":[66.9597,39.6542]}},
            {"name":"DEMO-UZ-0009 manzili","distance_m":920,"duration_s":110,"maneuver":{"type":"arrive","modifier":"left","location":[66.9880,39.6740]}}
        ]"""

        return listOf(
            ApprovedRouteEntity(
                id = "route-demo-1",
                destinationObjectId = "demo-obj-1",
                destinationName = "DEMO-UZ-0001 · Yong‘in gidranti 01",
                requestedBy = "acc-emp-1",
                geometryJson = routeGeom1,
                stepsJson = steps1,
                distanceM = 1730.0,
                durationS = 200.0,
                status = "approved",
                approvedBy = "Demo hudud rahbari",
                expiresAtEpochMs = nowMs + 8L * 3600_000L,
                sourceDate = "2026-11-01",
                version = 1,
                createdAt = isoUtcDaysAgo(0)
            ),
            ApprovedRouteEntity(
                id = "route-demo-2",
                destinationObjectId = "demo-obj-9",
                destinationName = "DEMO-UZ-0009 · Gaz quvuri 09",
                requestedBy = "acc-emp-2",
                geometryJson = routeGeom2,
                stepsJson = steps2,
                distanceM = 2070.0,
                durationS = 240.0,
                status = "pending",
                approvedBy = null,
                expiresAtEpochMs = null,
                sourceDate = "2026-11-01",
                version = 1,
                createdAt = isoUtcDaysAgo(0)
            )
        )
    }

    fun createDemoNotifications(): List<NotificationEntity> = listOf(
        NotificationEntity(
            id = "notif-demo-1",
            userId = null,
            title = "SINTETIK DEMO — Tizim tayyor",
            body = "Offline sinov bazasi 14 hudud, 16 kategoriya va 30 demo obyekt bilan yuklandi.",
            kind = "system",
            readAt = null,
            createdAt = isoUtcDaysAgo(0)
        ),
        NotificationEntity(
            id = "notif-demo-2",
            userId = "acc-emp-1",
            title = "Marshrut tasdiqlandi",
            body = "DEMO-UZ-0001 obyektiga xizmat marshruti hudud rahbari tomonidan tasdiqlandi.",
            kind = "route_approved",
            readAt = null,
            createdAt = isoUtcDaysAgo(0)
        )
    )
}
