# FVV GIS Uzbekistan

O‘zbekiston uchun mustaqil ishlab chiqilayotgan Android GIS va infratuzilma reyestri. Fuqarolar ommaviy xarita va shoshilinch bo‘lmagan murojaatlardan foydalanadi; tekshirilgan xodimlar faqat ruxsat berilgan operativ yozuvlar bilan ishlaydi.

**Bu rasmiy FVV ilovasi emas.** Rasmiy tasdiq, davlat gerbi yoki dispetcherlik integratsiyasi mavjud deb da’vo qilinmaydi. Sinov yozuvlari `SINTETIK DEMO` deb belgilanadi. Murojaat yuborish tez yordam yoki favqulodda xizmatlarga qo‘ng‘iroq qilish o‘rnini bosmaydi.

## Tarkib

| Qism | Texnologiya | Katalog |
| --- | --- | --- |
| Android | Flutter, Material 3, Riverpod, GoRouter, Dio, Freezed, Drift, MapLibre | `apps/mobile` |
| Admin panel | React, TypeScript, Vite, Tailwind, TanStack Query, MapLibre GL JS | `apps/admin-web` |
| API | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, Alembic | `services/api` |
| Ma’lumotlar | PostgreSQL 17/PostGIS 3.5, Redis, shaxsiy S3 | `infrastructure` |
| Xarita | O‘zbekiston Shortbread MBTiles, Martin, ixtiyoriy OSRM | `data/maps`, `infrastructure/deployment` |

Interfeysning asosiy tili o‘zbek lotin; ruscha va inglizcha tarjimalar, yuqori kontrast, yorug‘/qorong‘i mavzular ko‘zda tutilgan. Xodim ruxsatlari serverda tekshiriladi. Qurilmadagi rol tanlovi imtiyoz bermaydi.

## Mahalliy ishga tushirish

Python 3.12+, Node 24, `uv`, Docker va Docker Compose kerak. Android uchun qo‘shimcha Java 21, Flutter 3.47.8, Android SDK 36 va NDK 28.2.13676358 kerak. Kutubxonalar lockfilelarda qayd etiladi; `npm ci` va `uv sync --frozen` ishlating.

### 1. Konfiguratsiya va baza

```sh
python scripts/init-env.py
scripts/compose up -d db redis
cd services/api
uv sync --frozen --group dev
uv run --env-file ../../.env alembic upgrade head
uv run --env-file ../../.env python -m app.cli seed-demo
```

`init-env.py` tasodifiy mahalliy sirlarni `.env` va `.secrets`ga yozadi; qiymatlarni chiqarmaydi. Ushbu fayllar Git va Docker build contextidan chiqarilgan. `.env.example` maydonlar ma’lumotnomasi; uni tayyor production konfiguratsiyasi deb ishlatmang.

`seed-demo` 14 hudud, 16 kategoriya, sintetik tuman/tashkilot va 30 demo obyekt yaratadi. Haqiqiy infratuzilma koordinatalari kiritilmagan. Hudud nomlari ISO ma’lumotnomasidan; demo tumanlar haqiqiy tuman chegaralari deb ko‘rsatilmaydi. Joriy rasmiy hudud/tuman geometriyalari operatordan vakolatli manba bilan olinishi kerak.

### 2. Alohida DB ruxsatlari va API

```sh
# services/api katalogidan; migratsiya egasi identifikatori bilan
uv run --env-file ../../.env python ../../scripts/configure-db-roles.py
uv run --env-file ../../.env.application \
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log
```

API hujjatlari: `http://localhost:8000/docs`; versiyalangan endpointlar `/api/v1` ostida. `.env.application` API va ommaviy GIS identifikatorlari bilan faqat ruxsat etilgan ilova sozlamalarini saqlaydi. `.env.runtime` operator uchun alohida retention identifikatorini ham saqlaydi; bu faylni API jarayoniga yuklamang. Migratsiya egasi kalitlarini production APIga bermang. Konfiguratsiya o‘zgarganda operator buyrug‘ini qayta bajarib `.env.application`ni yangilang. Ruxsatlar bo‘yicha tafsilot: [operator yo‘riqnomasi](docs/OPERATIONS.md).

### 3. O‘zbekiston basemapi

```sh
# loyiha ildizidan; taxminan 322 MB
python scripts/fetch-map.py
scripts/compose --profile maps up -d martin
```

Yuklanma checksumga mos kelmasa skript to‘xtaydi. Bu ochiq OSM basemapi; maxfiy infratuzilma tile fayllariga yozilmaydi. Manba va litsenziyalar: [ma’lumot manbalari](docs/DATA_SOURCES.md). Basemap yo‘q bo‘lsa interfeys buni ko‘rsatadi; yashirin uchinchi tomon xaritasi ulab yuborilmaydi.

### 4. Admin panel

```sh
cd apps/admin-web
npm ci
npm run dev
```

`http://localhost:5173`ni oching. Vite API va tile so‘rovlarini mahalliy xizmatlarga yo‘naltiradi. Kirish haqiqiy backend OTP oqimi orqali; test OTP faqat development konfiguratsiyasi va sintetik hisoblar uchun ko‘rsatiladi.

Demo hisoblari: fuqaro `+998900000001`; xodimlar `+998900000011`–`+998900000013`; tekshiruvchi `+998900000021`; hudud rahbari `+998900000031`; administrator `+998900000099`. Bular faqat test uchun; tashqi SMS yuborilmaydi. Administrator birinchi kirishda MFA sozlaydi. Production administratorini `python -m app.cli create-admin --phone ... --name ...` operator buyrug‘i bilan yarating; mavjud hisob rolini ushbu buyruq bilan yashirincha almashtirish mumkin emas.

## Android ilovasini yig‘ish

Flutter SDK arxivi ishlamasa tekshirilgan manba tegidan foydalanish mumkin:

```sh
git clone --depth 1 --branch 3.47.8 https://github.com/flutter/flutter.git /your/tools/flutter
export PATH="/your/tools/flutter/bin:$PATH"
flutter --version
cd apps/mobile
flutter pub get --enforce-lockfile
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

Debug APK kutiladigan joy: `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`. Fayl muvaffaqiyatli yig‘ilgandan keyingina APK tayyor deb hisoblanadi; joriy haqiqiy natijalar [TEST_RESULTS.md](docs/TEST_RESULTS.md)da qayd etiladi.

`10.0.2.2` faqat Android emulatori orqali shu kompyuterga murojaat qiladi. Haqiqiy telefonda ilova yetib bora oladigan test server manzilini `API_BASE_URL` bilan bering. Production uchun tasdiqlangan HTTPS URL zarur. Qurilma interneti, serverning tashqi kirish sozlamasi va ruxsatlar alohida tekshiriladi.

Cloud workspace uy katalogi faqat o‘qish uchun bo‘lsa, Flutter/Dart keshlarini yozish mumkin bo‘lgan kataloglarga yo‘naltiring:

```sh
export PUB_CACHE=/workspace/toolchains/pub-cache
export XDG_CONFIG_HOME=/workspace/toolchains/config
export XDG_CACHE_HOME=/workspace/toolchains/cache
export ANALYZER_STATE_LOCATION_OVERRIDE=/workspace/toolchains/dart-analyzer-state
export GRADLE_USER_HOME=/workspace/toolchains/gradle-cache
export FLUTTER_SUPPRESS_ANALYTICS=true
export DASH__SUPPRESS_ANALYTICS=true
```

Bu muhitda disk hajmi cheklangan. Android SDK/NDK va Gradle keshlari uchun yetarli bo‘sh joy tekshiriladi; joy tugagan yig‘ma APK yaratilganini anglatmaydi. Bitta ARM64 sinov qurilmasi uchun `flutter build apk --debug --target-platform android-arm64 ...` bilan kichikroq yig‘ma tanlash mumkin. CI odatiy ko‘p arxitekturali yig‘mani saqlaydi.

Firebase Android konfiguratsiyasi kalitlarini manbaga qo‘shmang. Push sozlanmaganda ilova ichidagi bildirishnomalar ishlatiladi; push yetkazilgan deb da’vo qilinmaydi.

### APK/AAB relizi

1. Operator Android imzolash kalitini himoyalangan joyda yaratadi va saqlaydi.
2. GitHub `production` environmentga `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` secretlari qo‘shiladi.
3. `Signed Android release` workflowida tekshirilgan commit/tag va tasdiqlangan HTTPS API URL beriladi.
4. Workflow testlardan keyin imzolangan APK va AAB yaratadi. Signing fayllari yakunda tozalanadi. Production relizi debug kaliti bilan yashirincha imzolanmaydi.

Mahalliy muhitda ham `scripts/android-signing.py` himoyalangan muhit o‘zgaruvchilaridan konfiguratsiya yaratadi. Keyin:

```sh
flutter build apk --release --dart-define=API_BASE_URL=https://your-approved-domain/api/v1
flutter build appbundle --release --dart-define=API_BASE_URL=https://your-approved-domain/api/v1
```

## Xavfsizlik va ish jarayoni

- Telefon tasdiqlanmaguncha sessiya berilmaydi. Xodim arizasi `pending_verification` bo‘ladi; tashkilot/hudud va rolni vakolatli administrator tekshiradi.
- Ruxsatlar rol, hudud, tuman, tashkilot, kategoriya, maxfiylik va javobgarlik asosida hisoblanadi. Qoralama egasi uni ko‘ra oladi; umumiy operativ xarita tasdiqlanib nashr qilingan versiyani oladi.
- Muhim texnik maydonlar turlangan jadvallarda, qo‘shimcha maydonlar versiyalangan kategoriya sxemalarida saqlanadi. Noma’lum qiymat nolga almashtirilmaydi. Gidrant o‘lchovining sanasi va birliklari alohida ko‘rsatiladi.
- Parallel tahrir `expected_version` bilan tekshiriladi; eskirgan versiya `409` qaytaradi. Sinxronlash operatsiya UUIDsi va payload hash bilan takroriy yozuvlarni oldini oladi.
- Fuqarolar alohida tekshirilgan public proyeksiyani oladi. Xodim tasdig‘i fuqarolarga avtomatik nashr emas. Public DB identifikatori private jadvallarni o‘qiy olmaydi.
- Fayllar karantinga olinadi; ClamAV yo‘q yoki tekshiruv muvaffaqiyatsiz bo‘lsa toza deb belgilanmaydi. Yuklab olish server ruxsatidan o‘tadi.
- Offline cheklangan yozuvlar shifrlanadi, sakkiz soatlik grant bilan ochiladi. Internetdan uzilgan qurilmaga bekor qilishni darhol yetkazishning iloji yo‘q; grant muddati shu chegarani belgilaydi. Yuborilmagan ishlar jim o‘chirilmaydi.
- Audit va obyekt reviziyalari oddiy API identifikatori tomonidan o‘zgartirilmaydi yoki o‘chirilmaydi. Audit retention alohida maintenance identifikatori va tasdiqlangan siyosat bilan bajariladi.

## Integratsiyalar va ishga tushirish chegaralari

| Integratsiya | Kerakli sozlama | Sozlanmagandagi xatti-harakat |
| --- | --- | --- |
| Eskiz SMS | operator hisobi, sender, SMS shablonlari | development-only test OTP; production test OTPni rad etadi |
| Firebase push | himoyalangan service-account va Android konfiguratsiyasi | ilova ichidagi bildirishnomalar; yuborilganlik da’vosi yo‘q |
| S3/SeaweedFS | private bucket va alohida app/operator kalitlari | faqat developmentda mahalliy fayl saqlash |
| ClamAV | ishlayotgan scanner | fayl karantinda qoladi |
| OSRM | qayta ishlangan OSM yo‘llari va manba sanasi | soxta marshrut yaratilmaydi; operativ navigatsiya ochilmaydi |
| Rasmiy dispetcherlik | ruxsatli integratsiya mavjud emas | murojaatlar mustaqil non-emergency xizmati sifatida belgilanadi |

Haqiqiy murojaatlar uchun operator aloqa ma’lumotlari, mas’ul jamoasi va tasdiqlangan retention davrlari talab qilinadi. Ushbu tashqi ma’lumotlar hali loyiha bilan berilmagan; `LIVE_INTAKE_ENABLED=false` saqlanadi. Ichki gaz/elektr sxemalari, haqiqiy infratuzilma yoki shaxsiy ma’lumotlarni demo datasetga qo‘shmang.

## Tekshirish

```sh
cd services/api
uv run --env-file ../../.env pytest -q
cd ../../apps/admin-web
npm test
npm run build
cd ../mobile
flutter analyze
flutter test
```

GitHub Actions backendni haqiqiy PostGIS bilan, admin panelni build/test bilan, Androidni analyze/test/debug APK bilan tekshiradi. Reliz workflowi alohida boshqariladi. Test natijalari taxmin qilinmaydi: so‘nggi bajarilgan natijalar, bloklar va tekshirilmagan qismlar [TEST_RESULTS.md](docs/TEST_RESULTS.md)da ajratiladi.

Zaxiralash, tiklash, deletion-journal replay, staging/production va fon vazifalari: [OPERATIONS.md](docs/OPERATIONS.md). Fuqarolar va xodimlar uchun qisqa qo‘llanma: [USER_GUIDE_UZ.md](docs/USER_GUIDE_UZ.md).
