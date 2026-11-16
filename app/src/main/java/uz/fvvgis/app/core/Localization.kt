package uz.fvvgis.app.core

enum class AppLocale(val code: String, val displayName: String) {
    UZ("uz", "O‘zbekcha"),
    RU("ru", "Русский"),
    EN("en", "English");

    companion object {
        fun fromCode(code: String?): AppLocale =
            entries.firstOrNull { it.code == code } ?: UZ
    }
}

object L10n {
    fun text(locale: AppLocale, key: String): String {
        val entry = strings[key] ?: return key
        return entry[locale] ?: entry[AppLocale.UZ] ?: key
    }

    fun pick(locale: AppLocale, uz: String, ru: String, en: String): String =
        when (locale) {
            AppLocale.UZ -> uz
            AppLocale.RU -> ru
            AppLocale.EN -> en
        }

    private val strings: Map<String, Map<AppLocale, String>> = mapOf(
        "home" to mapOf(AppLocale.UZ to "Bosh sahifa", AppLocale.RU to "Главная", AppLocale.EN to "Home"),
        "map" to mapOf(AppLocale.UZ to "Xarita", AppLocale.RU to "Карта", AppLocale.EN to "Map"),
        "registry" to mapOf(AppLocale.UZ to "Reyestr", AppLocale.RU to "Реестр", AppLocale.EN to "Registry"),
        "add" to mapOf(AppLocale.UZ to "Qo‘shish", AppLocale.RU to "Добавить", AppLocale.EN to "Add"),
        "report" to mapOf(AppLocale.UZ to "Murojaat", AppLocale.RU to "Обращение", AppLocale.EN to "Report"),
        "reports" to mapOf(AppLocale.UZ to "Murojaatlarim", AppLocale.RU to "Мои обращения", AppLocale.EN to "My reports"),
        "profile" to mapOf(AppLocale.UZ to "Profil", AppLocale.RU to "Профиль", AppLocale.EN to "Profile"),
        "inspections" to mapOf(AppLocale.UZ to "Tekshiruvlar", AppLocale.RU to "Проверки", AppLocale.EN to "Inspections"),
        "notifications" to mapOf(AppLocale.UZ to "Bildirishnomalar", AppLocale.RU to "Уведомления", AppLocale.EN to "Notifications"),
        "login" to mapOf(AppLocale.UZ to "Kirish", AppLocale.RU to "Войти", AppLocale.EN to "Sign in"),
        "register" to mapOf(AppLocale.UZ to "Ro‘yxatdan o‘tish", AppLocale.RU to "Регистрация", AppLocale.EN to "Register"),
        "phone" to mapOf(AppLocale.UZ to "Telefon raqami", AppLocale.RU to "Номер телефона", AppLocale.EN to "Phone number"),
        "name" to mapOf(AppLocale.UZ to "To‘liq ism", AppLocale.RU to "Полное имя", AppLocale.EN to "Full name"),
        "password" to mapOf(AppLocale.UZ to "Parol", AppLocale.RU to "Пароль", AppLocale.EN to "Password"),
        "password_rules" to mapOf(
            AppLocale.UZ to "Kamida 8 belgi, harf va raqam",
            AppLocale.RU to "Минимум 8 символов, буквы и цифры",
            AppLocale.EN to "At least 8 characters with letters and digits"
        ),
        "continue" to mapOf(AppLocale.UZ to "Davom etish", AppLocale.RU to "Продолжить", AppLocale.EN to "Continue"),
        "verify" to mapOf(AppLocale.UZ to "Tasdiqlash", AppLocale.RU to "Подтвердить", AppLocale.EN to "Verify"),
        "code" to mapOf(AppLocale.UZ to "Tasdiqlash kodi", AppLocale.RU to "Код подтверждения", AppLocale.EN to "Verification code"),
        "citizen" to mapOf(AppLocale.UZ to "Fuqaro", AppLocale.RU to "Гражданин", AppLocale.EN to "Citizen"),
        "employee" to mapOf(AppLocale.UZ to "Xodim arizasi", AppLocale.RU to "Заявка сотрудника", AppLocale.EN to "Employee application"),
        "organization" to mapOf(AppLocale.UZ to "Tashkilot", AppLocale.RU to "Организация", AppLocale.EN to "Organization"),
        "department" to mapOf(AppLocale.UZ to "Bo‘lim", AppLocale.RU to "Отдел", AppLocale.EN to "Department"),
        "reference" to mapOf(AppLocale.UZ to "Tekshirish uchun ma’lumotnoma", AppLocale.RU to "Ссылка для проверки", AppLocale.EN to "Verification reference"),
        "independent" to mapOf(
            AppLocale.UZ to "Mustaqil loyiha · Rasmiy davlat ilovasi emas",
            AppLocale.RU to "Независимый проект · Не государственное приложение",
            AppLocale.EN to "Independent project · Not an official government app"
        ),
        "publicMap" to mapOf(AppLocale.UZ to "Ommaviy xarita", AppLocale.RU to "Общедоступная карта", AppLocale.EN to "Public map"),
        "operationalMap" to mapOf(AppLocale.UZ to "Operativ xarita", AppLocale.RU to "Оперативная карта", AppLocale.EN to "Operational map"),
        "search" to mapOf(
            AppLocale.UZ to "Nomi, manzili yoki kodi bo‘yicha qidirish",
            AppLocale.RU to "Поиск по имени, адресу или коду",
            AppLocale.EN to "Search name, address or code"
        ),
        "region" to mapOf(AppLocale.UZ to "Hudud", AppLocale.RU to "Регион", AppLocale.EN to "Region"),
        "district" to mapOf(AppLocale.UZ to "Tuman", AppLocale.RU to "Район", AppLocale.EN to "District"),
        "category" to mapOf(AppLocale.UZ to "Kategoriya", AppLocale.RU to "Категория", AppLocale.EN to "Category"),
        "all" to mapOf(AppLocale.UZ to "Barchasi", AppLocale.RU to "Все", AppLocale.EN to "All"),
        "status" to mapOf(AppLocale.UZ to "Holat", AppLocale.RU to "Состояние", AppLocale.EN to "Status"),
        "layers" to mapOf(AppLocale.UZ to "Qatlamlar", AppLocale.RU to "Слои", AppLocale.EN to "Layers"),
        "working" to mapOf(AppLocale.UZ to "Ishlaydi", AppLocale.RU to "Работает", AppLocale.EN to "Working"),
        "faulty" to mapOf(AppLocale.UZ to "Nosoz", AppLocale.RU to "Неисправен", AppLocale.EN to "Faulty"),
        "under_maintenance" to mapOf(AppLocale.UZ to "Ta’mirda", AppLocale.RU to "На обслуживании", AppLocale.EN to "Under maintenance"),
        "temporarily_unavailable" to mapOf(AppLocale.UZ to "Vaqtincha mavjud emas", AppLocale.RU to "Временно недоступен", AppLocale.EN to "Temporarily unavailable"),
        "not_inspected" to mapOf(AppLocale.UZ to "Tekshirilmagan", AppLocale.RU to "Не проверен", AppLocale.EN to "Not inspected"),
        "unknown" to mapOf(AppLocale.UZ to "Noma’lum", AppLocale.RU to "Неизвестно", AppLocale.EN to "Unknown"),
        "draft" to mapOf(AppLocale.UZ to "Qoralama", AppLocale.RU to "Черновик", AppLocale.EN to "Draft"),
        "submitted" to mapOf(AppLocale.UZ to "Yuborilgan", AppLocale.RU to "Отправлен", AppLocale.EN to "Submitted"),
        "under_review" to mapOf(AppLocale.UZ to "Ko‘rib chiqilmoqda", AppLocale.RU to "На проверке", AppLocale.EN to "Under review"),
        "approved" to mapOf(AppLocale.UZ to "Tasdiqlangan", AppLocale.RU to "Одобрен", AppLocale.EN to "Approved"),
        "published" to mapOf(AppLocale.UZ to "Nashr etilgan", AppLocale.RU to "Опубликован", AppLocale.EN to "Published"),
        "rejected" to mapOf(AppLocale.UZ to "Rad etilgan", AppLocale.RU to "Отклонён", AppLocale.EN to "Rejected"),
        "requires_correction" to mapOf(AppLocale.UZ to "Tuzatish kerak", AppLocale.RU to "Нужны исправления", AppLocale.EN to "Correction required"),
        "archived" to mapOf(AppLocale.UZ to "Arxivlangan", AppLocale.RU to "Архивирован", AppLocale.EN to "Archived"),
        "received" to mapOf(AppLocale.UZ to "Qabul qilingan", AppLocale.RU to "Получено", AppLocale.EN to "Received"),
        "triaged" to mapOf(AppLocale.UZ to "Saralangan", AppLocale.RU to "Отсортировано", AppLocale.EN to "Triaged"),
        "open" to mapOf(AppLocale.UZ to "Qabul qilingan", AppLocale.RU to "Получено", AppLocale.EN to "Received"),
        "new" to mapOf(AppLocale.UZ to "Yangi", AppLocale.RU to "Новое", AppLocale.EN to "New"),
        "assigned" to mapOf(AppLocale.UZ to "Biriktirilgan", AppLocale.RU to "Назначено", AppLocale.EN to "Assigned"),
        "in_progress" to mapOf(AppLocale.UZ to "Jarayonda", AppLocale.RU to "В работе", AppLocale.EN to "In progress"),
        "resolved" to mapOf(AppLocale.UZ to "Hal etilgan", AppLocale.RU to "Решено", AppLocale.EN to "Resolved"),
        "closed" to mapOf(AppLocale.UZ to "Yopilgan", AppLocale.RU to "Закрыто", AppLocale.EN to "Closed"),
        "refresh" to mapOf(AppLocale.UZ to "Yangilash", AppLocale.RU to "Обновить", AppLocale.EN to "Refresh"),
        "retry" to mapOf(AppLocale.UZ to "Qayta urinish", AppLocale.RU to "Повторить", AppLocale.EN to "Retry"),
        "empty" to mapOf(AppLocale.UZ to "Hozircha yozuvlar yo‘q", AppLocale.RU to "Пока нет записей", AppLocale.EN to "No records yet"),
        "offline" to mapOf(
            AppLocale.UZ to "Offline — ma’lumot eskirgan bo‘lishi mumkin",
            AppLocale.RU to "Офлайн — данные могут устареть",
            AppLocale.EN to "Offline — data may be outdated"
        ),
        "sync" to mapOf(AppLocale.UZ to "Sinxronlash", AppLocale.RU to "Синхронизировать", AppLocale.EN to "Synchronize"),
        "queue" to mapOf(AppLocale.UZ to "Sinxronlash navbati", AppLocale.RU to "Очередь синхронизации", AppLocale.EN to "Synchronization queue"),
        "technicalPassport" to mapOf(AppLocale.UZ to "Texnik pasport", AppLocale.RU to "Технический паспорт", AppLocale.EN to "Technical passport"),
        "updated" to mapOf(AppLocale.UZ to "Yangilangan", AppLocale.RU to "Обновлено", AppLocale.EN to "Updated"),
        "accuracy" to mapOf(AppLocale.UZ to "Koordinata aniqligi", AppLocale.RU to "Точность координат", AppLocale.EN to "Coordinate accuracy"),
        "measurement" to mapOf(AppLocale.UZ to "O‘lchov sanasi", AppLocale.RU to "Дата измерения", AppLocale.EN to "Measurement date"),
        "pressure" to mapOf(AppLocale.UZ to "O‘lchangan bosim", AppLocale.RU to "Измеренное давление", AppLocale.EN to "Measured pressure"),
        "flow" to mapOf(AppLocale.UZ to "Suv sarfi", AppLocale.RU to "Расход воды", AppLocale.EN to "Water flow"),
        "edit" to mapOf(AppLocale.UZ to "Tahrirlash", AppLocale.RU to "Редактировать", AppLocale.EN to "Edit"),
        "submit" to mapOf(AppLocale.UZ to "Ko‘rib chiqishga yuborish", AppLocale.RU to "Отправить на проверку", AppLocale.EN to "Submit for review"),
        "saveDraft" to mapOf(AppLocale.UZ to "Qoralamani saqlash", AppLocale.RU to "Сохранить черновик", AppLocale.EN to "Save draft"),
        "save" to mapOf(AppLocale.UZ to "Saqlash", AppLocale.RU to "Сохранить", AppLocale.EN to "Save"),
        "cancel" to mapOf(AppLocale.UZ to "Bekor qilish", AppLocale.RU to "Отмена", AppLocale.EN to "Cancel"),
        "description" to mapOf(AppLocale.UZ to "Tavsif", AppLocale.RU to "Описание", AppLocale.EN to "Description"),
        "codeLabel" to mapOf(AppLocale.UZ to "Obyekt kodi", AppLocale.RU to "Код объекта", AppLocale.EN to "Object code"),
        "objectName" to mapOf(AppLocale.UZ to "Obyekt nomi", AppLocale.RU to "Название объекта", AppLocale.EN to "Object name"),
        "geometry" to mapOf(AppLocale.UZ to "Geometriya", AppLocale.RU to "Геометрия", AppLocale.EN to "Geometry"),
        "point" to mapOf(AppLocale.UZ to "Nuqta", AppLocale.RU to "Точка", AppLocale.EN to "Point"),
        "line" to mapOf(AppLocale.UZ to "Chiziq", AppLocale.RU to "Линия", AppLocale.EN to "Line"),
        "polygon" to mapOf(AppLocale.UZ to "Poligon", AppLocale.RU to "Полигон", AppLocale.EN to "Polygon"),
        "gps" to mapOf(AppLocale.UZ to "GPS joylashuvim", AppLocale.RU to "Моя геопозиция", AppLocale.EN to "My GPS location"),
        "latitude" to mapOf(AppLocale.UZ to "Kenglik", AppLocale.RU to "Широта", AppLocale.EN to "Latitude"),
        "longitude" to mapOf(AppLocale.UZ to "Uzunlik", AppLocale.RU to "Долгота", AppLocale.EN to "Longitude"),
        "attachments" to mapOf(AppLocale.UZ to "Suratlar va hujjatlar", AppLocale.RU to "Фото и документы", AppLocale.EN to "Photos and documents"),
        "addPhoto" to mapOf(AppLocale.UZ to "Surat qo‘shish", AppLocale.RU to "Добавить фото", AppLocale.EN to "Add photo"),
        "addFile" to mapOf(AppLocale.UZ to "Hujjat qo‘shish", AppLocale.RU to "Добавить документ", AppLocale.EN to "Add document"),
        "review" to mapOf(AppLocale.UZ to "Tekshirish", AppLocale.RU to "Проверить", AppLocale.EN to "Review"),
        "emergencyNotice" to mapOf(
            AppLocale.UZ to "Shoshilinch xavf bo‘lsa 112 ga qo‘ng‘iroq qiling. Bu xizmat rasmiy dispetcherlik o‘rnini bosmaydi.",
            AppLocale.RU to "При непосредственной опасности звоните 112. Этот сервис не заменяет официальную диспетчерскую.",
            AppLocale.EN to "In immediate danger call 112. This service does not replace official emergency dispatch."
        ),
        "nonEmergency" to mapOf(
            AppLocale.UZ to "Shoshilinch bo‘lmagan murojaat",
            AppLocale.RU to "Неэкстренное обращение",
            AppLocale.EN to "Non-emergency report"
        ),
        "newReport" to mapOf(AppLocale.UZ to "Murojaat yuborish", AppLocale.RU to "Отправить обращение", AppLocale.EN to "Send a report"),
        "send" to mapOf(AppLocale.UZ to "Yuborish", AppLocale.RU to "Отправить", AppLocale.EN to "Send"),
        "includeLocation" to mapOf(AppLocale.UZ to "Joylashuvni qo‘shish", AppLocale.RU to "Добавить геопозицию", AppLocale.EN to "Include location"),
        "darkMode" to mapOf(AppLocale.UZ to "Qorong‘i mavzu", AppLocale.RU to "Тёмная тема", AppLocale.EN to "Dark theme"),
        "language" to mapOf(AppLocale.UZ to "Til", AppLocale.RU to "Язык", AppLocale.EN to "Language"),
        "logout" to mapOf(AppLocale.UZ to "Hisobdan chiqish", AppLocale.RU to "Выйти", AppLocale.EN to "Sign out"),
        "deleteAccount" to mapOf(AppLocale.UZ to "Akkauntni o‘chirish", AppLocale.RU to "Удалить аккаунт", AppLocale.EN to "Delete account"),
        "deleteConfirm" to mapOf(
            AppLocale.UZ to "Akkaunt o‘chirilsinmi? Saqlash siyosati va qonuniy talablar qo‘llanadi.",
            AppLocale.RU to "Удалить аккаунт? Применяются правила хранения и законные требования.",
            AppLocale.EN to "Delete your account? Retention policy and legal requirements apply."
        ),
        "pendingVerification" to mapOf(
            AppLocale.UZ to "Xodim arizangiz tekshirilmoqda. Hozir fuqaro ruxsatlari amal qiladi.",
            AppLocale.RU to "Заявка сотрудника проверяется. Пока доступны права гражданина.",
            AppLocale.EN to "Employee verification is pending. Citizen permissions apply for now."
        ),
        "synthetic" to mapOf(AppLocale.UZ to "SINTETIK DEMO", AppLocale.RU to "СИНТЕТИЧЕСКОЕ ДЕМО", AppLocale.EN to "SYNTHETIC DEMO"),
        "required" to mapOf(AppLocale.UZ to "Bu maydon majburiy", AppLocale.RU to "Обязательное поле", AppLocale.EN to "This field is required"),
        "route" to mapOf(AppLocale.UZ to "Tasdiqlangan marshrut", AppLocale.RU to "Одобренный маршрут", AppLocale.EN to "Approved route"),
        "requestRoute" to mapOf(AppLocale.UZ to "Marshrut so‘rash", AppLocale.RU to "Запросить маршрут", AppLocale.EN to "Request a route"),
        "measure" to mapOf(AppLocale.UZ to "Masofa o‘lchash", AppLocale.RU to "Измерить расстояние", AppLocale.EN to "Measure distance"),
        "lastSync" to mapOf(AppLocale.UZ to "Oxirgi sinxronlash", AppLocale.RU to "Последняя синхронизация", AppLocale.EN to "Last synchronization"),
        "permission" to mapOf(AppLocale.UZ to "Ruxsat", AppLocale.RU to "Доступ", AppLocale.EN to "Access"),
        "check" to mapOf(AppLocale.UZ to "Tekshiruv qo‘shish", AppLocale.RU to "Добавить проверку", AppLocale.EN to "Add inspection"),
        "publish" to mapOf(AppLocale.UZ to "Tasdiqlash va nashr etish", AppLocale.RU to "Одобрить и опубликовать", AppLocale.EN to "Approve & Publish"),
        "reject" to mapOf(AppLocale.UZ to "Rad etish", AppLocale.RU to "Отклонить", AppLocale.EN to "Reject"),
        "good" to mapOf(AppLocale.UZ to "Yaxshi", AppLocale.RU to "Хорошее", AppLocale.EN to "Good"),
        "fair" to mapOf(AppLocale.UZ to "Qoniqarli", AppLocale.RU to "Удовлетворительное", AppLocale.EN to "Fair"),
        "poor" to mapOf(AppLocale.UZ to "Qoniqarsiz", AppLocale.RU to "Неудовлетворительное", AppLocale.EN to "Poor"),
        "addRegistryItem" to mapOf(
            AppLocale.UZ to "Obyekt qo‘shish",
            AppLocale.RU to "Добавить объект",
            AppLocale.EN to "Add item"
        ),
        "gisSdkPlaceholder" to mapOf(
            AppLocale.UZ to "GIS SDK o‘rnini bosuvchi",
            AppLocale.RU to "Заглушка GIS SDK",
            AppLocale.EN to "GIS SDK Placeholder"
        ),
        "gisSdkPlaceholderHint" to mapOf(
            AppLocale.UZ to "Kelajakda to‘liq GIS xarita SDK (MapLibre / vektor tayllar) ulanishi uchun soddalashtirilgan ko‘rinish.",
            AppLocale.RU to "Базовый экран-заглушка для последующей интеграции GIS-карты SDK (MapLibre / векторные тайлы).",
            AppLocale.EN to "Placeholder map surface prepared for future GIS mapping SDK integration (MapLibre / vector tiles)."
        ),
        "gisSdkStatusTitle" to mapOf(
            AppLocale.UZ to "GIS Mapping SDK holati",
            AppLocale.RU to "Статус GIS Mapping SDK",
            AppLocale.EN to "GIS Mapping SDK Status"
        ),
        "gisSdkEngine" to mapOf(
            AppLocale.UZ to "Joriy ko‘rinish",
            AppLocale.RU to "Текущий вид",
            AppLocale.EN to "Current view"
        ),
        "gisSdkEngineValue" to mapOf(
            AppLocale.UZ to "Placeholder vektor kontur",
            AppLocale.RU to "Макет-заглушка (вектор)",
            AppLocale.EN to "Placeholder Canvas Preview"
        ),
        "gisSdkTarget" to mapOf(
            AppLocale.UZ to "Rejalashtirilgan SDK",
            AppLocale.RU to "Целевой SDK",
            AppLocale.EN to "Target SDK"
        ),
        "gisSdkTargetValue" to mapOf(
            AppLocale.UZ to "MapLibre Native · MBTiles",
            AppLocale.RU to "MapLibre Native · MBTiles",
            AppLocale.EN to "MapLibre Native · MBTiles"
        ),
        "employeeRequiredForAdd" to mapOf(
            AppLocale.UZ to "Reyestrga yangi obyekt qo‘shish uchun xodim sifatida tizimga kiring.",
            AppLocale.RU to "Войдите как сотрудник, чтобы добавить новый объект в реестр.",
            AppLocale.EN to "Sign in as an employee to add a new registry item."
        ),
        "markersList" to mapOf(
            AppLocale.UZ to "Xarita markerlari",
            AppLocale.RU to "Маркеры на карте",
            AppLocale.EN to "Map markers"
        ),
        "coordinates" to mapOf(
            AppLocale.UZ to "Koordinatalar",
            AppLocale.RU to "Координаты",
            AppLocale.EN to "Coordinates"
        ),
        "markerCount" to mapOf(
            AppLocale.UZ to "marker",
            AppLocale.RU to "маркеров",
            AppLocale.EN to "markers"
        ),
        "searchByNameOrType" to mapOf(
            AppLocale.UZ to "Nomi, turi yoki kodi bo‘yicha qidirish",
            AppLocale.RU to "Поиск по названию, типу или коду",
            AppLocale.EN to "Search by name, type or code"
        ),
        "itemType" to mapOf(
            AppLocale.UZ to "Obyekt turi",
            AppLocale.RU to "Тип объекта",
            AppLocale.EN to "Item type"
        ),
        "lifecycle" to mapOf(
            AppLocale.UZ to "Hayotiy bosqich",
            AppLocale.RU to "Статус записи",
            AppLocale.EN to "Lifecycle"
        ),
        "centerOnMap" to mapOf(
            AppLocale.UZ to "Xaritada fokus",
            AppLocale.RU to "Показать на карте",
            AppLocale.EN to "Center on map"
        ),
        "groupInfrastructure" to mapOf(
            AppLocale.UZ to "Infratuzilma",
            AppLocale.RU to "Инфраструктура",
            AppLocale.EN to "Infrastructure"
        ),
        "groupHazards" to mapOf(
            AppLocale.UZ to "Xavfli obyektlar",
            AppLocale.RU to "Опасные объекты",
            AppLocale.EN to "Hazards"
        ),
        "groupEquipment" to mapOf(
            AppLocale.UZ to "Jihoz va manbalar",
            AppLocale.RU to "Оборудование",
            AppLocale.EN to "Equipment"
        ),
        "clusterObjects" to mapOf(
            AppLocale.UZ to "Klasterdagi obyektlar",
            AppLocale.RU to "Объекты в кластере",
            AppLocale.EN to "Cluster items"
        ),
        "realMapBadge" to mapOf(
            AppLocale.UZ to "O‘zbekiston xaritasi · OSM",
            AppLocale.RU to "Карта Узбекистана · OSM",
            AppLocale.EN to "Uzbekistan Map · OSM"
        ),
        "realMapOfflineBadge" to mapOf(
            AppLocale.UZ to "Offline xarita konturi",
            AppLocale.RU to "Офлайн-контур карты",
            AppLocale.EN to "Offline Map Contour"
        ),
        "realMapEngineValue" to mapOf(
            AppLocale.UZ to "MapLibre Native (OpenGL ES) · OpenFreeMap",
            AppLocale.RU to "MapLibre Native (OpenGL ES) · OpenFreeMap",
            AppLocale.EN to "MapLibre Native (OpenGL ES) · OpenFreeMap"
        ),
        "realMapHint" to mapOf(
            AppLocale.UZ to "OpenFreeMap / OpenStreetMap vektor tayllari asosida O‘zbekistonning real xaritasi. Internet bo‘lmaganda mahalliy kontur xarita ishlaydi.",
            AppLocale.RU to "Реальная векторная карта Узбекистана на базе OpenFreeMap / OpenStreetMap. В офлайн-режиме используется локальный контур.",
            AppLocale.EN to "Real vector map of Uzbekistan powered by OpenFreeMap / OpenStreetMap tiles, with automatic offline contour fallback."
        ),
        "locationPermissionTitle" to mapOf(
            AppLocale.UZ to "Aniq GPS joylashuvi",
            AppLocale.RU to "Точная геолокация GPS",
            AppLocale.EN to "Precise GPS Location"
        ),
        "locationPermissionRationale" to mapOf(
            AppLocale.UZ to "Xaritani joriy GPS joylashuvingizga markazlash va jonli harakatni kuzatish uchun aniq joylashuv ruxsati kerak.",
            AppLocale.RU to "Для центрирования карты на вашей текущей позиции GPS и отслеживания перемещения требуется доступ к точному местоположению.",
            AppLocale.EN to "Precise location access is needed to center the map on your current GPS position and track your live coordinates."
        ),
        "locationPermissionApproximateHint" to mapOf(
            AppLocale.UZ to "Hozircha faqat taxminiy joylashuv berilgan. Xarita aniq ishlashi uchun aniq GPS ruxsatini yoqing.",
            AppLocale.RU to "Сейчас разрешена только приблизительная геопозиция. Включите точную геолокацию для точного GPS-трекинга.",
            AppLocale.EN to "Only approximate location is currently granted. Enable precise location for accurate GPS tracking."
        ),
        "locationPermissionDeniedPermanent" to mapOf(
            AppLocale.UZ to "Joylashuv ruxsati rad etilgan. Sozlamalardan aniq joylashuvga ruxsat bering.",
            AppLocale.RU to "Доступ к геолокации отклонён. Разрешите точную геолокацию в настройках приложения.",
            AppLocale.EN to "Location permission was denied. Enable precise location access in App Settings."
        ),
        "allowPreciseLocation" to mapOf(
            AppLocale.UZ to "Aniq GPS ga ruxsat berish",
            AppLocale.RU to "Разрешить точный GPS",
            AppLocale.EN to "Allow precise GPS"
        ),
        "openSettings" to mapOf(
            AppLocale.UZ to "Sozlamalarni ochish",
            AppLocale.RU to "Открыть настройки",
            AppLocale.EN to "Open settings"
        ),
        "gpsTrackingActive" to mapOf(
            AppLocale.UZ to "GPS kuzatuv faol",
            AppLocale.RU to "GPS-трекинг активен",
            AppLocale.EN to "GPS tracking active"
        ),
        "gpsTrackingStopped" to mapOf(
            AppLocale.UZ to "GPS kuzatuv to‘xtatildi",
            AppLocale.RU to "GPS-трекинг остановлен",
            AppLocale.EN to "GPS tracking paused"
        ),
        "emergencyMode" to mapOf(
            AppLocale.UZ to "Favqulodda rejim",
            AppLocale.RU to "Экстренный режим",
            AppLocale.EN to "Emergency mode"
        ),
        "emergencyModeActive" to mapOf(
            AppLocale.UZ to "FAVQULODDA REJIM FAOL",
            AppLocale.RU to "ЭКСТРЕННЫЙ РЕЖИМ АКТИВЕН",
            AppLocale.EN to "EMERGENCY MODE ACTIVE"
        ),
        "emergencyLongPressHint" to mapOf(
            AppLocale.UZ to "Xavf belgisini qo‘yish uchun xaritani bosib turing (long-press) va markaziy reyestrga yuboring.",
            AppLocale.RU to "Удерживайте палец на карте (long-press), чтобы поставить метку и отправить инцидент в реестр.",
            AppLocale.EN to "Long-press anywhere on the map to drop a pin and report an incident to the central registry."
        ),
        "emergencyDropAtMyGps" to mapOf(
            AppLocale.UZ to "GPS nuqtamga qo‘yish",
            AppLocale.RU to "Поставить по моему GPS",
            AppLocale.EN to "Pin my GPS"
        ),
        "emergencySheetTitle" to mapOf(
            AppLocale.UZ to "Tezkor xavf / hodisa xabari",
            AppLocale.RU to "Срочное сообщение об инциденте",
            AppLocale.EN to "Instant Hazard / Incident Report"
        ),
        "emergencyHazardType" to mapOf(
            AppLocale.UZ to "Xavf yoki nosozlik turi",
            AppLocale.RU to "Тип угрозы или аварии",
            AppLocale.EN to "Hazard or incident type"
        ),
        "emergencyPinCoordinates" to mapOf(
            AppLocale.UZ to "Belgilangan nuqta (Pin)",
            AppLocale.RU to "Координаты метки (Pin)",
            AppLocale.EN to "Dropped pin coordinates"
        ),
        "emergencyCurrentGps" to mapOf(
            AppLocale.UZ to "Sizning joriy GPS koordinatangiz",
            AppLocale.RU to "Ваши текущие GPS-координаты",
            AppLocale.EN to "Your current GPS coordinates"
        ),
        "emergencyGpsUnavailable" to mapOf(
            AppLocale.UZ to "GPS olinmadi — ruxsat bering yoki yangilang",
            AppLocale.RU to "GPS недоступен — разрешите или обновите",
            AppLocale.EN to "GPS unavailable — grant access or capture"
        ),
        "emergencyCaptureGps" to mapOf(
            AppLocale.UZ to "GPS olish",
            AppLocale.RU to "Получить GPS",
            AppLocale.EN to "Capture GPS"
        ),
        "emergencyNotesHint" to mapOf(
            AppLocale.UZ to "Qisqacha holat tavsifi (ixtiyoriy: tutun, sizib chiqish, shikastlanish...)",
            AppLocale.RU to "Краткое описание ситуации (необязательно: дым, утечка, порыв...)",
            AppLocale.EN to "Brief situation notes (optional: smoke, leak, damage...)"
        ),
        "emergencySubmitCta" to mapOf(
            AppLocale.UZ to "Markaziy reyestrga yuborish",
            AppLocale.RU to "Отправить в центральный реестр",
            AppLocale.EN to "Submit to Central Registry"
        ),
        "emergencySubmittedMsg" to mapOf(
            AppLocale.UZ to "Markaziy reyestrga tezkor yuborildi",
            AppLocale.RU to "Отправлено в центральный реестр",
            AppLocale.EN to "Reported to central registry"
        ),
        "emergencyCall112" to mapOf(
            AppLocale.UZ to "112 ga qo‘ng‘iroq",
            AppLocale.RU to "Позвонить 112",
            AppLocale.EN to "Call 112"
        ),
        "emergencyClearPin" to mapOf(
            AppLocale.UZ to "Belgini bekor qilish",
            AppLocale.RU to "Сбросить метку",
            AppLocale.EN to "Clear pin"
        ),
        "hazardGasLeak" to mapOf(
            AppLocale.UZ to "Gaz sizib chiqishi / Quvur",
            AppLocale.RU to "Утечка газа / Газопровод",
            AppLocale.EN to "Gas leak / Pipeline"
        ),
        "hazardElectrical" to mapOf(
            AppLocale.UZ to "Elektr kabeli / Podstansiya",
            AppLocale.RU to "Электросеть / Подстанция",
            AppLocale.EN to "Electrical / Substation"
        ),
        "hazardWaterMain" to mapOf(
            AppLocale.UZ to "Suv quvuri yorilishi",
            AppLocale.RU to "Прорыв водопровода",
            AppLocale.EN to "Water main break"
        ),
        "hazardHydrantFault" to mapOf(
            AppLocale.UZ to "Yong‘in gidranti nosozligi",
            AppLocale.RU to "Неисправность гидранта",
            AppLocale.EN to "Fire hydrant fault"
        ),
        "hazardGeneral" to mapOf(
            AppLocale.UZ to "Favqulodda xavf / Hodisa",
            AppLocale.RU to "Чрезвычайный инцидент",
            AppLocale.EN to "Emergency hazard"
        ),
        "shortestRoute" to mapOf(
            AppLocale.UZ to "Eng qisqa yo‘l",
            AppLocale.RU to "Кратчайший путь",
            AppLocale.EN to "Shortest route"
        ),
        "pathfindingTitle" to mapOf(
            AppLocale.UZ to "Favqulodda marshrut (A*)",
            AppLocale.RU to "Экстренный маршрут (A*)",
            AppLocale.EN to "Emergency Pathfinding"
        ),
        "vehicleProfile" to mapOf(
            AppLocale.UZ to "Maxsus texnika turi",
            AppLocale.RU to "Профиль спецтехники",
            AppLocale.EN to "Emergency vehicle profile"
        ),
        "vehicleFireEngine" to mapOf(
            AppLocale.UZ to "O‘t o‘chirish mashinasi",
            AppLocale.RU to "Пожарная машина",
            AppLocale.EN to "Fire Engine"
        ),
        "vehicleFireEngineSpecs" to mapOf(
            AppLocale.UZ to "18 t · kengligi 3.6 m · balandligi 3.9 m",
            AppLocale.RU to "18 т · шир. 3.6 м · выс. 3.9 м",
            AppLocale.EN to "18t · 3.6m width · 3.9m height"
        ),
        "vehicleRescue4x4" to mapOf(
            AppLocale.UZ to "Qutqaruv 4x4",
            AppLocale.RU to "Спасательный 4x4",
            AppLocale.EN to "Rescue 4x4"
        ),
        "vehicleRescue4x4Specs" to mapOf(
            AppLocale.UZ to "3.8 t · kengligi 2.4 m · yo‘lsiz joydan o‘tadi",
            AppLocale.RU to "3.8 т · шир. 2.4 м · вездеходный",
            AppLocale.EN to "3.8t · 2.4m width · all-terrain"
        ),
        "vehicleAmbulanceHazmat" to mapOf(
            AppLocale.UZ to "Tez yordam / RKB",
            AppLocale.RU to "Скорая / РХБЗ",
            AppLocale.EN to "Ambulance / Hazmat"
        ),
        "vehicleAmbulanceHazmatSpecs" to mapOf(
            AppLocale.UZ to "6.5 t · kengligi 2.8 m · xavfsiz yo‘lak",
            AppLocale.RU to "6.5 т · шир. 2.8 м · безопасный коридор",
            AppLocale.EN to "6.5t · 2.8m width · hazard-safe"
        ),
        "bypassFaultyHazards" to mapOf(
            AppLocale.UZ to "Nosoz xavf hududlarini aylanib o‘tish",
            AppLocale.RU to "Объезд аварийных участков",
            AppLocale.EN to "Bypass faulty hazard zones"
        ),
        "routeOriginGps" to mapOf(
            AppLocale.UZ to "Boshlanish (Sizning GPS)",
            AppLocale.RU to "Старт (Ваш GPS)",
            AppLocale.EN to "Origin (Your GPS)"
        ),
        "routeDestination" to mapOf(
            AppLocale.UZ to "Manzil (Infratuzilma)",
            AppLocale.RU to "Цель (Инфраструктура)",
            AppLocale.EN to "Destination (Marker)"
        ),
        "selectDestinationMarker" to mapOf(
            AppLocale.UZ to "Manzil obyektini tanlang",
            AppLocale.RU to "Выберите целевой объект",
            AppLocale.EN to "Select destination marker"
        ),
        "routeAccessibleFull" to mapOf(
            AppLocale.UZ to "To‘liq o‘tish mumkin",
            AppLocale.RU to "Полностью проезжий",
            AppLocale.EN to "Fully accessible"
        ),
        "routeAccessibleCaution" to mapOf(
            AppLocale.UZ to "Ehtiyotkorlik bilan o‘tish",
            AppLocale.RU to "Проезд с осторожностью",
            AppLocale.EN to "Accessible with caution"
        ),
        "routeDetourApplied" to mapOf(
            AppLocale.UZ to "Aylanma yo‘l qo‘llandi",
            AppLocale.RU to "Построен доступный объезд",
            AppLocale.EN to "Accessible detour applied"
        ),
        "routeRestrictedLastMile" to mapOf(
            AppLocale.UZ to "So‘nggi metrlar cheklangan",
            AppLocale.RU to "Ограничение на подъезде",
            AppLocale.EN to "Last-mile access restricted"
        ),
        "avoidedObstacles" to mapOf(
            AppLocale.UZ to "Chetlab o‘tilgan to‘siqlar",
            AppLocale.RU to "Обойдённые ограничения",
            AppLocale.EN to "Avoided road constraints"
        ),
        "turnByTurnSteps" to mapOf(
            AppLocale.UZ to "Yo‘l bosqichlari va o‘tish holati",
            AppLocale.RU to "Этапы маршрута и проходимость",
            AppLocale.EN to "Route segments & accessibility"
        ),
        "roadWidthWeight" to mapOf(
            AppLocale.UZ to "Min. yo‘l kengligi / yuk",
            AppLocale.RU to "Мин. ширина / нагрузка",
            AppLocale.EN to "Min width / weight limit"
        ),
        "clearRoute" to mapOf(
            AppLocale.UZ to "Yo‘lni tozalash",
            AppLocale.RU to "Сбросить маршрут",
            AppLocale.EN to "Clear route"
        ),
        "showOnMap" to mapOf(
            AppLocale.UZ to "Xaritada ko‘rsatish",
            AppLocale.RU to "Показать на карте",
            AppLocale.EN to "Show on map"
        ),
        "etaMinutes" to mapOf(
            AppLocale.UZ to "daq",
            AppLocale.RU to "мин",
            AppLocale.EN to "min"
        ),
        "obstacleNarrowLane" to mapOf(
            AppLocale.UZ to "Tor ko‘cha (2.9 m)",
            AppLocale.RU to "Узкий переулок (2.9 м)",
            AppLocale.EN to "Narrow lane (2.9 m)"
        ),
        "obstacleWeakBridge" to mapOf(
            AppLocale.UZ to "Cheklangan ko‘prik (10 t)",
            AppLocale.RU to "Мост с ограничением (10 т)",
            AppLocale.EN to "Weight-limited bridge (10 t)"
        ),
        "obstacleMountainPass" to mapOf(
            AppLocale.UZ to "Tog‘ dovoni (balandlik/xavf)",
            AppLocale.RU to "Горный перевал (габарит)",
            AppLocale.EN to "Mountain pass clearance"
        ),
        "obstacleUnpavedTrack" to mapOf(
            AppLocale.UZ to "Tuproq yo‘l (og‘ir texnikaga yopiq)",
            AppLocale.RU to "Грунтовка (закрыто для тяжёлой техники)",
            AppLocale.EN to "Unpaved track (heavy restricted)"
        ),
        "obstacleHazardZone" to mapOf(
            AppLocale.UZ to "Nosoz obyekt xavf zonasi",
            AppLocale.RU to "Аварийная зона объекта",
            AppLocale.EN to "Faulty hazard zone"
        ),
        "roadHighway" to mapOf(
            AppLocale.UZ to "Magistral trassa",
            AppLocale.RU to "Магистраль",
            AppLocale.EN to "National Highway"
        ),
        "roadArterial" to mapOf(
            AppLocale.UZ to "Keng shahar ko‘chasi",
            AppLocale.RU to "Магистральная улица",
            AppLocale.EN to "Urban Arterial"
        ),
        "roadCollector" to mapOf(
            AppLocale.UZ to "Tuman yo‘li",
            AppLocale.RU to "Районная дорога",
            AppLocale.EN to "District Collector"
        ),
        "roadBridge" to mapOf(
            AppLocale.UZ to "Ko‘prik / O‘tish joyi",
            AppLocale.RU to "Мост / Переезд",
            AppLocale.EN to "Bridge / Overpass"
        ),
        "roadNarrow" to mapOf(
            AppLocale.UZ to "Tor mahalla ko‘chasi",
            AppLocale.RU to "Узкий проезд",
            AppLocale.EN to "Narrow Service Lane"
        ),
        "roadUnpaved" to mapOf(
            AppLocale.UZ to "Tuproq / Shag‘al yo‘l",
            AppLocale.RU to "Грунтовая дорога",
            AppLocale.EN to "Unpaved Access Road"
        ),
        "downloadArea" to mapOf(
            AppLocale.UZ to "Hududni yuklab olish",
            AppLocale.RU to "Скачать область",
            AppLocale.EN to "Download Area"
        ),
        "offlineMaps" to mapOf(
            AppLocale.UZ to "Offline xaritalar",
            AppLocale.RU to "Офлайн-карты",
            AppLocale.EN to "Offline Maps"
        ),
        "offlineAreaHint" to mapOf(
            AppLocale.UZ to "Aloqa kuchsiz hududlarda ishlash uchun tanlangan viloyat yoki ko‘rinish tayllarini qurilma xotirasiga saqlang.",
            AppLocale.RU to "Сохраните тайлы выбранного региона в память устройства для работы при слабой или отсутствующей связи.",
            AppLocale.EN to "Save vector map tiles for a selected region to local device storage for offline access in low-signal areas."
        ),
        "areaSelectionMode" to mapOf(
            AppLocale.UZ to "Hududni tanlash usuli",
            AppLocale.RU to "Выбор области",
            AppLocale.EN to "Area selection"
        ),
        "currentMapView" to mapOf(
            AppLocale.UZ to "Joriy xarita ko‘rinishi",
            AppLocale.RU to "Текущий экран карты",
            AppLocale.EN to "Current map view"
        ),
        "selectUzbekistanRegion" to mapOf(
            AppLocale.UZ to "Viloyat / shahar",
            AppLocale.RU to "Регион Узбекистана",
            AppLocale.EN to "Uzbekistan region"
        ),
        "tileDetailLevel" to mapOf(
            AppLocale.UZ to "Xarita tafsiloti",
            AppLocale.RU to "Детализация карты",
            AppLocale.EN to "Map detail level"
        ),
        "detailOverview" to mapOf(
            AppLocale.UZ to "Umumiy (Z6–11)",
            AppLocale.RU to "Обзор (Z6–11)",
            AppLocale.EN to "Overview (Z6–11)"
        ),
        "detailCity" to mapOf(
            AppLocale.UZ to "Shahar va ko‘chalar (Z8–14)",
            AppLocale.RU to "Город и улицы (Z8–14)",
            AppLocale.EN to "City & Streets (Z8–14)"
        ),
        "detailStreet" to mapOf(
            AppLocale.UZ to "Batafsil ko‘cha (Z10–15)",
            AppLocale.RU to "Детально (Z10–15)",
            AppLocale.EN to "Street Detail (Z10–15)"
        ),
        "estimatedTiles" to mapOf(
            AppLocale.UZ to "Taxminiy tayllar",
            AppLocale.RU to "Оценка тайлов",
            AppLocale.EN to "Estimated tiles"
        ),
        "estimatedSize" to mapOf(
            AppLocale.UZ to "Taxminiy hajm",
            AppLocale.RU to "Оценка размера",
            AppLocale.EN to "Estimated size"
        ),
        "downloadNow" to mapOf(
            AppLocale.UZ to "Xotiraga yuklab olish",
            AppLocale.RU to "Скачать в память",
            AppLocale.EN to "Download to device"
        ),
        "downloadingTiles" to mapOf(
            AppLocale.UZ to "Tayllar yuklanmoqda...",
            AppLocale.RU to "Загрузка тайлов...",
            AppLocale.EN to "Downloading tiles..."
        ),
        "pauseDownload" to mapOf(
            AppLocale.UZ to "Pauza",
            AppLocale.RU to "Пауза",
            AppLocale.EN to "Pause"
        ),
        "resumeDownload" to mapOf(
            AppLocale.UZ to "Davom etish",
            AppLocale.RU to "Продолжить",
            AppLocale.EN to "Resume"
        ),
        "savedOfflineAreas" to mapOf(
            AppLocale.UZ to "Saqlangan offline hududlar",
            AppLocale.RU to "Сохранённые области",
            AppLocale.EN to "Saved offline areas"
        ),
        "noSavedOfflineAreas" to mapOf(
            AppLocale.UZ to "Hozircha saqlangan offline hududlar yo‘q.",
            AppLocale.RU to "Сохранённых офлайн-областей пока нет.",
            AppLocale.EN to "No offline map areas saved yet."
        ),
        "offlineReadyBadge" to mapOf(
            AppLocale.UZ to "Offline tayyor",
            AppLocale.RU to "Готово офлайн",
            AppLocale.EN to "Ready offline"
        ),
        "realMapCachedOfflineBadge" to mapOf(
            AppLocale.UZ to "Saqlangan offline tayllar",
            AppLocale.RU to "Кэш офлайн-тайлов",
            AppLocale.EN to "Cached Offline Tiles"
        ),
        "deleteArea" to mapOf(
            AppLocale.UZ to "O‘chirish",
            AppLocale.RU to "Удалить",
            AppLocale.EN to "Delete"
        ),
        "jumpToArea" to mapOf(
            AppLocale.UZ to "Xaritada ochish",
            AppLocale.RU to "Показать область",
            AppLocale.EN to "View on map"
        ),
        "downloadCompletedMsg" to mapOf(
            AppLocale.UZ to "Hudud offline foydalanish uchun saqlandi",
            AppLocale.RU to "Область сохранена для офлайн-доступа",
            AppLocale.EN to "Area saved for offline access"
        ),
        "downloadDeletedMsg" to mapOf(
            AppLocale.UZ to "Offline hudud o‘chirildi",
            AppLocale.RU to "Офлайн-область удалена",
            AppLocale.EN to "Offline area deleted"
        ),
        "tilesLabel" to mapOf(
            AppLocale.UZ to "tayl",
            AppLocale.RU to "тайлов",
            AppLocale.EN to "tiles"
        ),
        "queued_offline" to mapOf(
            AppLocale.UZ to "Offline navbatda",
            AppLocale.RU to "В офлайн-очереди",
            AppLocale.EN to "Queued offline"
        ),
        "emergencySaveOfflineCta" to mapOf(
            AppLocale.UZ to "Offline navbatga saqlash",
            AppLocale.RU to "Сохранить в офлайн-очередь",
            AppLocale.EN to "Save to offline queue"
        ),
        "emergencyOfflineSheetHint" to mapOf(
            AppLocale.UZ to "Aloqa yo‘q — xabar qurilmada saqlanadi va internet tiklanganda markaziy reyestrga avtomatik yuboriladi.",
            AppLocale.RU to "Нет сети — сообщение сохранится локально и автоматически отправится в реестр при появлении связи.",
            AppLocale.EN to "Offline — report will be stored locally and automatically pushed to the central registry when connection returns."
        ),
        "emergencyQueuedMsg" to mapOf(
            AppLocale.UZ to "Qurilma navbatiga saqlandi — aloqa tiklanganda avtomatik yuboriladi",
            AppLocale.RU to "Сохранено локально — отправится автоматически при появлении сети",
            AppLocale.EN to "Queued locally — will auto-send when online"
        ),
        "autoSyncCompletedMsg" to mapOf(
            AppLocale.UZ to "ta navbatdagi xabar markaziy reyestrga avtomatik yuborildi",
            AppLocale.RU to "сообщений из очереди автоматически отправлены в реестр",
            AppLocale.EN to "queued report(s) automatically pushed to central registry"
        ),
        "queuedReportsBadge" to mapOf(
            AppLocale.UZ to "Navbatda",
            AppLocale.RU to "В очереди",
            AppLocale.EN to "Queued"
        ),
        "waitingForNetworkHint" to mapOf(
            AppLocale.UZ to "Aloqa tiklanishi kutilmoqda — xabarlar avtomatik yuboriladi.",
            AppLocale.RU to "Ожидание сети — отчёты будут отправлены автоматически.",
            AppLocale.EN to "Waiting for network — queued reports will upload automatically."
        ),
        "networkStatusLabel" to mapOf(
            AppLocale.UZ to "Tarmoq holati",
            AppLocale.RU to "Состояние сети",
            AppLocale.EN to "Network status"
        ),
        "networkOnline" to mapOf(
            AppLocale.UZ to "Onlayn (avto-sinxronlash faol)",
            AppLocale.RU to "В сети (автоотправка активна)",
            AppLocale.EN to "Online (auto-push active)"
        ),
        "networkDeviceOffline" to mapOf(
            AppLocale.UZ to "Tarmoq uzilgan (offline navbat)",
            AppLocale.RU to "Нет подключения к сети (офлайн-очередь)",
            AppLocale.EN to "No network connection (local queue)"
        ),
        "entityEmergencyIncident" to mapOf(
            AppLocale.UZ to "Tezkor favqulodda xabar",
            AppLocale.RU to "Экстренный инцидент",
            AppLocale.EN to "Emergency incident report"
        ),
        "entityCitizenReport" to mapOf(
            AppLocale.UZ to "Fuqaro murojaati",
            AppLocale.RU to "Обращение гражданина",
            AppLocale.EN to "Citizen report"
        ),
        "entityInfrastructure" to mapOf(
            AppLocale.UZ to "Reyestr obyekti",
            AppLocale.RU to "Объект реестра",
            AppLocale.EN to "Registry object"
        ),
    )
}
