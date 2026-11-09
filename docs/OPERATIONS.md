# Operator uchun ishga tushirish va tiklash

Bu mustaqil taklif platformasi. Rasmiy FVV tasdig‘i, davlat infratuzilmasiga kirish yoki rasmiy dispetcherlik integratsiyasi mavjud deb hisoblanmaydi.

## Muhitlar va sirlar

`development` faqat sintetik yozuvlar va ochiq belgilangan test OTP bilan ishlaydi. `staging` va `production` test OTPni rad etadi, alohida ommaviy GIS bazasi identifikatori va shaxsiy S3 saqlashini talab qiladi. SMS hisoblari, Firebase service-account fayli, TLS/host nomi va Android imzolash kalitlari repozitoriyga kiritilmaydi.

Haqiqiy telefonlar, xodim ma’lumotlari yoki murojaatlarni qabul qilishdan oldin operatorning yuridik nomi, aloqa ma’lumotlari, mas’ul jamoasi va tasdiqlangan saqlash siyosati sozlanadi. `REPORT_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS` va `BACKUP_RETENTION_DAYS` uchun avtomatik muddat yo‘q. `LIVE_INTAKE_ENABLED=false` boshlang‘ich holatdir. Mahalliy qonunlar va Firebase/Eskiz orqali ma’lumot uzatish huquqiy ko‘rib chiqiladi.

## Bazadagi identifikatorlar

Migratsiyalarni bazaga egalik qiluvchi alohida operator identifikatori bilan bajaring. So‘ng:

```sh
cd services/api
uv run --env-file ../../.env python ../../scripts/configure-db-roles.py
```

Bu `.env.runtime` ichiga tasodifiy parollarni yozadi; qiymatlar terminalga chiqarilmaydi. API/worker `fvv_api_login → fvv_runtime`, ommaviy GIS `fvv_public_login → fvv_public`, audit tozalash esa `fvv_retention_login → fvv_retention` orqali ishlaydi. Ilova uchun alohida `.env.application` yaratiladi: faqat API/public URLlar va ruxsat etilgan ilova sozlamalari kiritiladi. Owner, migration, retention va storage-admin kalitlari chiqarib tashlanadi. API/workerga `.env` yoki `.env.runtime`ni to‘liq yuklamang. Compose ham shu chegarani aniq environment allowlist bilan saqlaydi. Konfiguratsiya o‘zgarganda operator buyrug‘i qayta bajariladi. Keyingi migratsiyalarda yangi jadvallarga tegishli ruxsatlar ham migratsiya bilan qo‘shilishi shart.

```sh
uv run --env-file ../../.env.application uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

## Fon vazifalari

Redis, S3 va ClamAV tayyor bo‘lgach `scripts/compose --profile jobs --profile storage --profile scanning up -d` ishlatiladi. S3dagi `S3_BUCKET`ni storage-operator identifikatori bilan oldindan yarating; ommaviy ACL yoqmang. ClamAV sozlanmaguncha yuklangan fayllar karantindan chiqmaydi. Firebase sozlanmasa, bildirishnomalar ilova ichida saqlanadi; push yetkazilgan deb ko‘rsatilmaydi.

`REGISTRATION_ORGANIZATION_IDS` faqat operator tasdiqlagan tashkilot IDlarini vergul bilan belgilaydi. Staging/productionda bo‘sh qiymat telefon tasdiqlashdan oldin tashkilot nomlarini ochmaydi; development/test faqat sintetik katalogdan foydalanadi.

Tasdiqlangan siyosat bo‘yicha operator schedulerida quyidagi buyruqlarni qo‘ying; har birining muvaffaqiyatsiz chiqish kodi monitoringga yuborilsin:

```sh
# services/api katalogidan, loyiha venv va operator env bilan
python -m app.worker --scan-pending       # har 5 daqiqada
python -m app.worker --flush-deletions    # har 5 daqiqada
python -m app.worker --retention          # har kuni
python ../../scripts/purge-audit.py       # har kuni, alohida maintenance identity bilan
```

Yopilmagan yoki legal-hold belgilangan murojaatlar avtomatik o‘chirilmaydi. O‘chirish avval DB tombstone bilan tranzaksiyada yoziladi, keyin alohida `RETENTION_LEDGER_DIRECTORY`ga fsync orqali chiqariladi va fayllar tozalanadi. Bu katalog shifrlangan hajmda, katalog ruxsati `0700`, fayllari `0600` bo‘lishi kerak. Jurnal DB snapshotlari bilan birga orqaga qaytarilmaydi: yangilangan jurnal mustaqil himoyalangan joyga muntazam nusxalanadi.

## Shifrlangan zaxira

Operator mashinasida PostgreSQL client va `age` kerak. Public age recipient `BACKUP_AGE_RECIPIENT` orqali beriladi; uning private identity kaliti alohida saqlanadi.

```sh
uv run --project services/api python scripts/backup.py --objects local
# S3 ishlatilganda: --objects s3
```

Buyruq DB dumpi, shaxsiy fayllar, deletion journal va SHA256 manifestini yaratadi. `retention-ledger-latest.tar.age` eng so‘nggi o‘chirish jurnalidir. Snapshot va eng yangi jurnalni alohida himoyalangan/offsite saqlashga nusxalang. Fayl faqat muvaffaqiyatli `age` shifrlashidan keyin yakuniy nomga o‘tadi. Backup muddatlari operator siyosatidan olinadi. Eng yangi jurnal eski snapshot bilan almashtirilmasin.

## Tiklash mashqi

1. API, worker va schedulerlarni to‘xtating; live intake o‘chiq bo‘lsin.
2. Snapshot manifesti, age identity va snapshotdan keyingi o‘chirishlarni ham qamrab oluvchi **eng yangi** mustaqil jurnalni oling.
3. `RESTORE_DATABASE_URL` yoki `MIGRATION_DATABASE_URL`ni himoyalangan muhit orqali bering; terminal tarixiga parol yozmang.
4. Alohida sinov bazasida quyidagini bajaring:

```sh
RESTORE_MAINTENANCE=true uv run --project services/api python scripts/restore.py \
  --manifest backups/fvv-TIMESTAMP-manifest.json \
  --identity /protected/operator.agekey \
  --latest-ledger /protected/retention-ledger-latest.tar.age \
  --objects local --confirm-database-replacement
```

Buyruq barcha snapshot checksumlarini tekshiradi, arxivdagi link va xavfli yo‘llarni rad etadi, DB/fayllarni tiklaydi va xizmat ochilishidan oldin eng yangi deletion jurnalini qayta qo‘llaydi. Istalgan xatoda xizmatlar yopiq qoladi. So‘ng migratsiya, DB-role himoyasi, ruxsat testlari va tanlangan yozuvlar tekshiriladi. Tiklash sanasi, manba manifesti, natijasi va operator identifikatori tashqi operatsion auditga yoziladi. Faqat tekshirishdan keyin xizmatlar ochiladi.

## Xarita va marshrutlar

`python scripts/fetch-map.py` tekshirilgan SHA256ga mos O‘zbekiston Shortbread MBTiles va OFL shriftini yuklaydi. Geofabrik yangilansa skript checksum mismatch bilan to‘xtaydi; yangi versiyani ko‘rib chiqib, `--sha256` orqali aniq tasdiqlangan checksumni bering. OSM/ODbL va shrift litsenziyasi ko‘rsatiladi. Xususiy infratuzilma basemap tile bazasiga qo‘shilmaydi.

OSRM uchun O‘zbekiston OSM PBFsi tekshirilgan manbadan olinadi, `osrm-extract -p /opt/car.lua`, `osrm-partition`, `osrm-customize` bajarilib `data/routing/uzbekistan-latest.osrm*` saqlanadi. `routing` profili shundan keyin yoqiladi. Bu oddiy yo‘l ma’lumotidir; rahbar tasdig‘i favqulodda sharoitda yo‘l ochiqligini kafolatlamaydi. Manba sanasi va tasdiq muddati ko‘rsatiladi.

## Ushbu cloud muhitidagi native yordamchi xizmatlar

Bu sessiyada Docker `vfs` layerlari diskni ortiqcha ishlatgani uchun PostgreSQL17/PostGIS3.5 va Martin1.15 native vositalar bilan ishga tushirildi. Ular `/workspace/toolchains`da, loyiha manba kodiga kirmaydi. Bu production usuli emas; boshqa mashina uchun Docker Compose yo‘li ishlatiladi. Muhit qayta ochilganda native xizmatlar to‘xtagan bo‘lishi mumkin. Aynan shu workspace uchun idempotent `python /workspace/toolchains/restart-local.py` yordamchisi mavjud; u yuklama qilmaydi, kerakli library pathlarni saqlaydi va mavjud jarayonni takroran yaratmaydi.
