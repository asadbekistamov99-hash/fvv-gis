import type { Language } from "./types";

// Complete sentences are keys so Uzbek source copy remains readable next to its UI.
const phrases: Record<string, readonly [string, string]> = {
  "Ma’lumot yuklanmoqda…": ["Загрузка данных…", "Loading data…"],
  required: ["обязательно", "required"],
  "14 hudud": ["14 регионов", "14 regions"],
  "Nazoratli kirish": ["Контроль доступа", "Controlled access"],
  "Yagona reyestr": ["Единый реестр", "Central registry"],
  "BOSHQARUV PLATFORMASI": ["ПЛАТФОРМА УПРАВЛЕНИЯ", "MANAGEMENT PLATFORM"],
  "Authenticator sozlash": ["Настроить Authenticator", "Set up Authenticator"],
  "Authenticator kaliti": ["Ключ Authenticator", "Authenticator key"],
  "Kalitni Authenticator ilovasiga qo‘shing. Uni boshqalar bilan ulashmang.": [
    "Добавьте ключ в Authenticator. Не передавайте его другим.",
    "Add this key to your Authenticator app. Do not share it.",
  ],
  "Ikki bosqichli tasdiqlash kodini kiriting.": [
    "Введите код двухфакторной проверки.",
    "Enter your two-factor verification code.",
  ],
  "Authenticator kodi": ["Код Authenticator", "Authenticator code"],
  Theme: ["Тема", "Theme"],
  Language: ["Язык", "Language"],
  "Operativ boshqaruv": ["Оперативное управление", "Operations workspace"],
  "O‘zbekiston Respublikasi": [
    "Республика Узбекистан",
    "Republic of Uzbekistan",
  ],
  "ISH MAYDONI": ["РАБОЧАЯ ОБЛАСТЬ", "WORKSPACE"],
  "Asosiy navigatsiya": ["Основная навигация", "Main navigation"],
  Menu: ["Меню", "Menu"],
  Platforma: ["Платформа", "Platform"],
  ADMINISTRATSIYA: ["АДМИНИСТРИРОВАНИЕ", "ADMINISTRATION"],
  "· Ko‘rsatilgan ma’lumot eskirgan bo‘lishi mumkin.": [
    "· Данные могут быть устаревшими.",
    "· Displayed information may be outdated.",
  ],
  "Markazlashgan reyestr": ["Централизованный реестр", "Centralized registry"],
  "qayd etilgan holat": ["зарегистрированное состояние", "recorded condition"],
  "O‘lchov sanasini tekshiring": [
    "Проверьте дату измерения",
    "Check the measurement date",
  ],
  "E’tibor talab qilinadi": ["Требуется внимание", "Requires attention"],
  "Tekshiruv va tasdiqlash": ["Проверка и согласование", "Review and approval"],
  "Vakolat doirasidagi infratuzilma": [
    "Инфраструктура в пределах ваших полномочий",
    "Infrastructure within your authorized scope",
  ],
  "Ish jarayonining joriy holati": [
    "Текущее состояние рабочих процессов",
    "Current workflow status",
  ],
  "Yangi yozuvlarni ko‘rib chiqing": [
    "Проверьте новые записи",
    "Review new records",
  ],
  "Mas’ul xodimga biriktiring": [
    "Назначьте ответственного сотрудника",
    "Assign a responsible employee",
  ],
  "Ruxsat va vakolat nazorati": [
    "Контроль прав и полномочий",
    "Access and responsibility controls",
  ],
  "HUDUDLAR KESIMIDA": ["ПО РЕГИОНАМ", "BY REGION"],
  "Hududlar statistikasi mavjud emas.": [
    "Статистика по регионам отсутствует.",
    "Regional statistics are unavailable.",
  ],
  "Nazoratli ma’lumot": ["Контролируемые данные", "Controlled information"],
  "Har bir o‘zgarish auditda qayd etiladi. Ommaviy va ichki ma’lumotlar alohida saqlanadi.":
    [
      "Каждое изменение фиксируется в аудите. Открытые и внутренние данные хранятся раздельно.",
      "Every change is audited. Public and internal data are stored separately.",
    ],
  "Eng so‘nggi ma’lumot va texnik holatlar": [
    "Последние данные и технические состояния",
    "Latest records and technical conditions",
  ],
  Eksport: ["Экспорт", "Export"],
  "· Xarita tanlangan filtrlar asosida ko‘rsatiladi.": [
    "· Карта соответствует выбранным фильтрам.",
    "· The map reflects the selected filters.",
  ],
  "· Haqiqiy infratuzilma joylashuvi emas.": [
    "· Это не местоположение реальной инфраструктуры.",
    "· These are not real infrastructure locations.",
  ],
  "O‘lchov natijasi doimiy emas. Joriy holatni oxirgi tekshiruv bilan solishtiring.":
    [
      "Результат измерения не бессрочен. Сравните состояние с последней проверкой.",
      "Measurements do not remain valid indefinitely. Compare the condition with the latest inspection.",
    ],
  "Foto yoki PDF biriktirish": [
    "Прикрепить фото или PDF",
    "Attach a photo or PDF",
  ],
  "Fayllar xavfsizlik tekshiruvidan keyin ochiladi": [
    "Файлы открываются после проверки безопасности",
    "Files become available after security scanning",
  ],
  "Fayl tekshirish uchun qabul qilindi": [
    "Файл принят на проверку",
    "File received for security scanning",
  ],
  "Gidrant turi": ["Тип гидранта", "Hydrant type"],
  "O‘rnatish turi": ["Тип установки", "Installation type"],
  "Ulanish diametri · mm": [
    "Диаметр подключения · мм",
    "Connection diameter · mm",
  ],
  "Nominal bosim · kPa": [
    "Номинальное давление · кПа",
    "Nominal pressure · kPa",
  ],
  "O‘lchangan bosim · kPa": [
    "Измеренное давление · кПа",
    "Measured pressure · kPa",
  ],
  "O‘lchangan suv sarfi · L/s": [
    "Измеренный расход · л/с",
    "Measured water flow · L/s",
  ],
  "O‘lchov sanasi": ["Дата измерения", "Measurement date"],
  "O‘lchov usuli": ["Метод измерения", "Measurement method"],
  "Kuchlanish · kV": ["Напряжение · кВ", "Voltage · kV"],
  "Kabel turi": ["Тип кабеля", "Cable type"],
  "O‘rnatish usuli": ["Способ установки", "Installation method"],
  "Diametr · mm": ["Диаметр · мм", "Diameter · mm"],
  Material: ["Материал", "Material"],
  "Uzunlik · m": ["Длина · м", "Length · m"],
  "Chuqurlik · m": ["Глубина · м", "Depth · m"],
  "Nomi, kodi, hududi va kategoriyasini to‘ldiring.": [
    "Укажите название, код, регион и категорию.",
    "Enter the name, code, region, and category.",
  ],
  "To‘g‘ri WGS84 GeoJSON geometriyasini kiriting. Polygon halqasi yopiq bo‘lishi kerak.":
    [
      "Введите допустимую геометрию WGS84 GeoJSON. Кольцо полигона должно быть замкнуто.",
      "Enter valid WGS84 GeoJSON geometry. Polygon rings must be closed.",
    ],
  "Geometriya noto‘g‘ri.": ["Недопустимая геометрия.", "Invalid geometry."],
  "Ma’lumotlarni tekshirib, tasdiqlash belgisini qo‘ying.": [
    "Проверьте данные и установите флажок подтверждения.",
    "Review the information and select the confirmation checkbox.",
  ],
  "Tuman identifikatori": ["Район", "District"],
  Ixtiyoriy: ["Необязательно", "Optional"],
  "Ko‘rinish tasnifi": ["Классификация доступа", "Visibility classification"],
  "Bu sintetik sinov yozuvi. Haqiqiy infratuzilma emas.": [
    "Синтетическая тестовая запись. Это не реальная инфраструктура.",
    "Synthetic test record. This is not real infrastructure.",
  ],
  "Geometriya turi": ["Тип геометрии", "Geometry type"],
  "GPS aniqligi · m": ["Точность GPS · м", "GPS accuracy · m"],
  "Noma’lum": ["Неизвестно", "Unknown"],
  "Nuqta, bir nechta segmentli chiziq yoki yopiq polygon chizing. Server geometriya va topologiyani qayta tekshiradi.":
    [
      "Нарисуйте точку, линию из сегментов или замкнутый полигон. Сервер повторно проверит геометрию и топологию.",
      "Draw a point, connected line segments, or a closed polygon. The server validates geometry and topology again.",
    ],
  "Noma’lum qiymatlarni bo‘sh qoldiring. Ular nolga almashtirilmaydi.": [
    "Оставьте неизвестные значения пустыми. Они не заменяются нулём.",
    "Leave unknown values empty. They will not be replaced with zero.",
  ],
  "JPEG, PNG yoki PDF · xavfsizlik tekshiruvi bilan": [
    "JPEG, PNG или PDF · с проверкой безопасности",
    "JPEG, PNG, or PDF · security scanning required",
  ],
  "Biriktirilgan fayllar": ["Вложения", "Attachments"],
  "Pasport maydonlari": ["Поля паспорта", "Passport fields"],
  "Ma’lumotlarni tekshirdim. Obyekt faqat vakolatli tekshiruv va tasdiqdan keyin operativ xaritaga chiqishini tushunaman.":
    [
      "Я проверил данные и понимаю, что объект появится на оперативной карте только после уполномоченной проверки и согласования.",
      "I reviewed this information and understand that the object enters the operational map only after authorized review and approval.",
    ],
  "Qoralama saqlash": ["Сохранить черновик", "Save draft"],
  "Rad etish sababini kamida 5 belgi bilan yozing.": [
    "Укажите причину отклонения длиной не менее 5 символов.",
    "Enter a rejection reason of at least 5 characters.",
  ],
  "O‘z yozuvingizni tasdiqlash mumkin emas. Ichki nashr fuqarolarga avtomatik ko‘rinmaydi.":
    [
      "Нельзя согласовать собственную запись. Внутренняя публикация не открывает данные гражданам автоматически.",
      "You cannot approve your own record. Internal publication does not automatically make it public.",
    ],
  "Rad etish sababi": ["Причина отклонения", "Rejection reason"],
  "Tekshiruv ma’lumotnomasi va hududni kiriting.": [
    "Укажите основание проверки и регион.",
    "Enter the verification reference and region.",
  ],
  "Rad etish sababini kiriting.": [
    "Укажите причину отклонения.",
    "Enter the rejection reason.",
  ],
  "Ariza beruvchi tashkilotga tegishli ekanligini tasdiqlangan tashqi jarayon orqali tekshiring. Bu platforma davlat tasdig‘ini bermaydi.":
    [
      "Проверьте принадлежность заявителя к организации по утверждённой внешней процедуре. Платформа не предоставляет государственного подтверждения.",
      "Verify affiliation through the approved external process. This platform does not provide government certification.",
    ],
  "Xodimlik arizalari": ["Заявки сотрудников", "Employee applications"],
  Xodim: ["Сотрудник", "Employee"],
  Tashkilot: ["Организация", "Organization"],
  Tekshirish: ["Проверить", "Review"],
  "Xodim vakolatini tekshirish": [
    "Проверка полномочий сотрудника",
    "Verify employee affiliation",
  ],
  "Tekshiruv ma’lumotnomasi": ["Основание проверки", "Verification reference"],
  "Tasdiqlangan tashqi tekshiruv havolasi yoki raqami": [
    "Ссылка или номер утверждённой внешней проверки",
    "Approved external verification reference or link",
  ],
  "Biriktiriladigan rol": ["Назначаемая роль", "Assigned role"],
  "Hudud tanlang": ["Выберите регион", "Choose a region"],
  "Murojaat tekshirilmaguncha tasdiqlangan hodisa hisoblanmaydi.": [
    "Обращение не считается подтверждённым происшествием до проверки.",
    "A report is not a confirmed incident until verified.",
  ],
  "Murojaatni ko‘rib chiqish": ["Рассмотрение обращения", "Review report"],
  "Mas’ul xodim identifikatori": [
    "Ответственный сотрудник",
    "Responsible employee",
  ],
  "Xodim UUID": ["Выберите сотрудника", "Choose an employee"],
  "Obyektni tanlang va tekshiruv tarixini ko‘ring": [
    "Выберите объект и просмотрите историю проверок",
    "Select an object to view its inspection history",
  ],
  "Tekshiruv qo‘shish": ["Добавить проверку", "Add inspection"],
  "Obyekt tanlang": ["Выберите объект", "Choose an object"],
  "Tekshiruvlarni ko‘rish uchun obyekt tanlang.": [
    "Выберите объект для просмотра проверок.",
    "Choose an object to view inspections.",
  ],
  "Yangi tekshiruv": ["Новая проверка", "New inspection"],
  "Qayd etilgan holat": ["Зафиксированное состояние", "Recorded condition"],
  "Tekshiruv izohi": ["Комментарий к проверке", "Inspection notes"],
  "Tekshiruv natijasi obyektni avtomatik ishlaydi deb belgilamaydi.": [
    "Результат проверки не устанавливает рабочее состояние автоматически.",
    "An inspection does not automatically mark an object as working.",
  ],
  "Sxema JSON obyekt bo‘lishi kerak.": [
    "Схема должна быть объектом JSON.",
    "The schema must be a JSON object.",
  ],
  "Kategoriya va pasportlar": [
    "Категории и паспорта",
    "Categories and passports",
  ],
  "Zaxira nusxalar": ["Резервные копии", "Backups"],
  "Schema v": ["Схема v", "Schema v"],
  Amal: ["Действие", "Action"],
  Foydalanuvchi: ["Пользователь", "User"],
  Natija: ["Результат", "Outcome"],
  Vaqt: ["Время", "Time"],
  "Zaxiralash holati": ["Состояние резервирования", "Backup status"],
  "Oxirgi tekshirilgan tiklash:": [
    "Последнее проверенное восстановление:",
    "Last verified restore:",
  ],
  "Shaxsiy ma’lumotlarni saqlash va o‘chirish muddatlari operatorning tasdiqlangan siyosati orqali belgilanadi. Nusxadan tiklanganda o‘chirish yozuvlari qayta qo‘llanadi.":
    [
      "Сроки хранения и удаления персональных данных определяются утверждённой политикой оператора. После восстановления повторно применяются записи об удалении.",
      "Personal-data retention and deletion follow the approved operator policy. Deletion records are reapplied after a restore.",
    ],
  "O‘zgarishlar yangi sxema versiyasini yaratadi. Muhim muhandislik maydonlari turlangan bazaviy jadvallarda saqlanadi.":
    [
      "Изменения создают новую версию схемы. Важные инженерные поля хранятся в типизированных таблицах.",
      "Changes create a new schema version. Important engineering fields remain in typed tables.",
    ],
  "Versiyalangan JSON sxema": [
    "Версионируемая схема JSON",
    "Versioned JSON schema",
  ],
  "Ma’lumotlar serverdan kelganda shu yerda ko‘rinadi.": [
    "Данные появятся здесь после загрузки с сервера.",
    "Records will appear here when received from the server.",
  ],
  "Yozuv boshqa foydalanuvchi tomonidan yangilangan. Ma’lumotni yangilang va tahrirlaringizni solishtiring.":
    [
      "Запись изменена другим пользователем. Обновите данные и сравните изменения.",
      "Another user updated this record. Refresh and compare your edits.",
    ],
  "Server bilan bog‘lanib bo‘lmadi. Internet va API manzilini tekshiring.": [
    "Не удалось подключиться к серверу. Проверьте сеть и адрес API.",
    "Cannot connect to the server. Check your connection and API address.",
  ],
  "So‘rov bajarilmadi. Qayta urinib ko‘ring.": [
    "Не удалось выполнить запрос. Повторите попытку.",
    "The request failed. Please try again.",
  ],
  "Faqat tekshirilgan yo‘l bo‘yicha harakatlaning.": [
    "Используйте только согласованный маршрут.",
    "Use only the approved route.",
  ],
  "Marshrut so‘rash": ["Запросить маршрут", "Request route"],
  "Boshlanish joyi": ["Начальная точка", "Origin"],
  Kenglik: ["Широта", "Latitude"],
  Uzunlik: ["Долгота", "Longitude"],
  "GPS orqali olish": ["Определить по GPS", "Use GPS"],
  "Rahbar tasdig‘i kerak": [
    "Требуется согласование руководителя",
    "Supervisor approval required",
  ],
  "Manba sanasi": ["Дата источника", "Source date"],
  "Amal qilish muddati": ["Срок действия", "Valid until"],
  "Tasdiqni bekor qilish": ["Отозвать согласование", "Withdraw approval"],
  "Yo‘l tafsilotlari": ["Описание маршрута", "Route details"],
  "Faol xodimlar": ["Активные сотрудники", "Active employees"],
  "Ruxsatlarni saqlash": ["Сохранить права", "Save permissions"],
  "Kirishni to‘xtatish": ["Приостановить доступ", "Suspend access"],
  "Ruxsat o‘zgarsa, mavjud sessiyalar bekor qilinadi.": [
    "Изменение прав отзывает существующие сеансы.",
    "Changing permissions revokes existing sessions.",
  ],
  "Barcha ruxsatli kategoriyalar": [
    "Все разрешённые категории",
    "All permitted categories",
  ],
  "Eng yuqori maxfiylik": ["Максимальная секретность", "Maximum sensitivity"],
  "Yangi bildirishnoma": ["Новое уведомление", "New notification"],
  Sarlavha: ["Заголовок", "Title"],
  Xabar: ["Сообщение", "Message"],
  "Ommaviy e’lon": ["Публичное объявление", "Public announcement"],
  "Ommaviy matnni tasdiqlash": [
    "Утвердить публичный текст",
    "Approve public text",
  ],
  "Shaxsiy bildirishnomada tafsilotlar push orqali yuborilmaydi.": [
    "Детали личных уведомлений не отправляются через push.",
    "Private notification details are never sent through push.",
  ],
  Yuborish: ["Отправить", "Send"],
  "Ko‘rib chiqish asosi": ["Основание решения", "Decision reference"],
  Tanlanmagan: ["Не выбрано", "Not selected"],
  "Obyekt va to‘g‘ri GPS koordinatalarini kiriting.": [
    "Выберите объект и введите допустимые координаты GPS.",
    "Select an object and enter valid GPS coordinates.",
  ],
  "Marshrut oddiy yo‘l ma’lumotlari asosida tuziladi; favqulodda harakat uchun yaroqlilikni operator tekshiradi.":
    [
      "Маршрут рассчитан по обычным дорожным данным; оператор проверяет пригодность для оперативного использования.",
      "Routes use ordinary road data; the operator checks suitability for operational use.",
    ],
  "Manzil obyekti": ["Объект назначения", "Destination object"],
  "Muddati tugagan": ["Срок истёк", "Expired"],
  "Bekor qilingan": ["Отозвано", "Withdrawn"],
  "Marshrutlar xususiy yo‘l xizmati orqali hisoblanadi. Xizmat ishlamasa soxta yo‘l ko‘rsatilmaydi.":
    [
      "Маршруты рассчитываются частным сервисом. Если сервис недоступен, вымышленный маршрут не отображается.",
      "Routes are calculated by the private routing service. An unavailable service never produces a fabricated route.",
    ],
  "Bu yo‘l faqat oldindan ko‘rish uchun. Tasdiqsiz yoki muddati tugagan marshrutdan operativ foydalanmang.":
    [
      "Это предварительный просмотр. Не используйте несогласованный или просроченный маршрут в работе.",
      "This is a preview. Do not use an unapproved or expired route operationally.",
    ],
  "Nomsiz yo‘l": ["Безымянная дорога", "Unnamed road"],
  "Ko‘rib chiqish asosi majburiy.": [
    "Укажите основание решения.",
    "A decision reference is required.",
  ],
  Rol: ["Роль", "Role"],
  Faol: ["Активен", "Active"],
  "To‘xtatilgan": ["Приостановлен", "Suspended"],
  Tuman: ["Район", "District"],
  "Barcha ruxsatli tumanlar": [
    "Все разрешённые районы",
    "All permitted districts",
  ],
  "Barcha ruxsatli tashkilotlar": [
    "Все разрешённые организации",
    "All permitted organizations",
  ],
  "Ruxsatli kategoriyalar": ["Разрешённые категории", "Permitted categories"],
  "Hech biri tanlanmasa barcha ruxsatli kategoriyalar qo‘llanadi.": [
    "Если ничего не выбрано, применяются все категории в пределах полномочий.",
    "No selection applies all categories within the permitted scope.",
  ],
  "Tashkilot tanlang": ["Выберите организацию", "Choose an organization"],
  "Ommaviy matn tasdiqlanishni kutmoqda.": [
    "Публичный текст ожидает проверки.",
    "Public text is awaiting review.",
  ],
  "Tasdiqlanishni kutayotgan ommaviy matnlar": [
    "Публичные тексты на проверке",
    "Public text awaiting review",
  ],
  "O‘qilgan deb belgilash": ["Отметить прочитанным", "Mark as read"],
  "Ruxsatlarning bir qismi sizning vakolatingizdan tashqarida. Ularni global administrator boshqaradi.":
    [
      "Часть назначений вне ваших полномочий. Ими управляет глобальный администратор.",
      "Some assignments are outside your scope. A global administrator manages them.",
    ],
};
const labels: Record<string, readonly [string, string, string]> = {
  citizen: ["Fuqaro", "Гражданин", "Citizen"],
  pending_employee: [
    "Tekshiruvdagi xodim",
    "Сотрудник на проверке",
    "Pending employee",
  ],
  verified_employee: [
    "Tasdiqlangan xodim",
    "Проверенный сотрудник",
    "Verified employee",
  ],
  regional_supervisor: [
    "Hudud rahbari",
    "Региональный руководитель",
    "Regional supervisor",
  ],
  infrastructure_inspector: [
    "Infratuzilma inspektori",
    "Инспектор инфраструктуры",
    "Infrastructure inspector",
  ],
  data_reviewer: [
    "Ma’lumot tekshiruvchisi",
    "Рецензент данных",
    "Data reviewer",
  ],
  system_administrator: [
    "Tizim administratori",
    "Администратор системы",
    "System administrator",
  ],
  super_administrator: [
    "Bosh administrator",
    "Главный администратор",
    "Super administrator",
  ],
  public: ["Ommaviy", "Публичный", "Public"],
  internal: ["Ichki", "Внутренний", "Internal"],
  restricted: ["Cheklangan", "Ограниченный", "Restricted"],
  confidential: ["Maxfiy", "Конфиденциальный", "Confidential"],
};
export function copy(language: Language, source: string): string {
  if (labels[source])
    return labels[source][language === "uz" ? 0 : language === "ru" ? 1 : 2];
  return language === "uz"
    ? source
    : phrases[source]?.[language === "ru" ? 0 : 1] || source;
}
export const translatedPhrases = phrases;
