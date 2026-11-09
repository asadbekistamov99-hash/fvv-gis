# FVV GIS Uzbekistan — davom ettirish prompti

Ushbu repository FVV GIS Uzbekistan platformasining hozirgacha ishlab chiqilgan manba kodidir. Ishni noldan boshlamang: mavjud monorepo, API, Flutter ilovasi va admin panelini saqlab, avval fayllarni tekshiring.

## Bajarilgan va tekshirilgan

- FastAPI + PostgreSQL/PostGIS + Alembic backend, `/api/v1`, RBAC/ABAC, audit, approval workflow, sync, public/restricted GIS projectionlari.
- Synthetic Uzbekistan region/category/object seed ma’lumotlari; haqiqiy infratuzilma koordinatalari kiritilmagan.
- Citizen va pending/verified employee oqimlari, OTP/MFA/refresh token/session revoke.
- Hydrant, pipeline, sewer, gas va electrical passport modellari; nullable qiymatlar, birliklar va o‘lchov sanalari saqlanadi.
- React/TypeScript admin paneli, MapLibre xarita, approval va notification boshqaruvi.
- Flutter Material 3 Android ilovasi, Uzbek default/RU/EN lokalizatsiya asoslari, Riverpod, GoRouter, Dio, Drift/SQLite offline queue.
- Backend testlari: 65 passed. Admin panel: 8 unit test va production build qayd etilgan. Operatsion tekshiruvlar: 5 passed. Flutter: 10 test passed deb qayd etilgan, lekin yakuniy analyzer natijasi qayta tekshirilishi kerak.

## Hali yakunlanmagan

- APK/AAB hali yaratilmadi. Oxirgi Android build disk to‘lishi va AGP 9/Flutter moslik xatosi bilan to‘xtagan.
- Flutter analyzer va to‘liq Android buildni AGP versiyasini moslab, kamida 20 GB bo‘sh diskli muhitda qayta ishga tushiring.
- Offline basemap download UI va to‘liq mobil E2E oqimlarini yakunlang.
- Real Eskiz/FCM yuborish, S3/ClamAV/OSRM, hosting, backup/restore va production CI/CD ni real credentiallar bilan alohida tekshiring.
- Operator retention siyosati, data governance, employee affiliation va production GIS dataset authorization hali berilmagan.

## Qoidalar

Maxfiy `.env`, token, signing key va production ma’lumotlarini commit qilmang. Rasmiy FVV endorsementi yoki rasmiy infratuzilma ma’lumotlari haqida da’vo qilmang. Synthetic demo ma’lumotlarini aniq belgilang. Har bir yangi tekshiruvning haqiqiy natijasini `docs/TEST_RESULTS.md` ga yozing; APK mavjudligini faqat fayl real yaratilgandan keyin bildiring.

## Ishga tushirish

Root `README.md` va `docs/OPERATIONS.md` ni o‘qing. Backend uchun `services/api` ichida `uv sync` va `uv run pytest -q`; web uchun `apps/admin-web` ichida `npm ci`, `npm test`, `npm run build`; mobile uchun Flutter SDK bilan `flutter pub get`, codegen, `flutter analyze`, `flutter test`, so‘ng Android APK buildini bajaring.
