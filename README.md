# FVV GIS Uzbekistan (Native Android)

O‘zbekiston uchun mustaqil ishlab chiqilgan **Kotlin + Jetpack Compose** asosidagi offline-first GIS va infratuzilma reyestri Android ilovasi. Fuqarolar ommaviy xarita va shoshilinch bo‘lmagan murojaatlardan foydalanadi; tekshirilgan xodimlar ruxsatga asoslangan operativ yozuvlar, tekshiruvlar, marshrutlar va sinxronlash navbati bilan ishlaydi.

**Mustaqil loyiha · Rasmiy davlat ilovasi emas.** Rasmiy tasdiq, davlat gerbi yoki dispetcherlik integratsiyasi mavjud deb da’vo qilinmaydi. Sinov yozuvlari `SINTETIK DEMO` deb belgilanadi. Murojaat yuborish `112` yoki shoshilinch xizmatlarga qo‘ng‘iroq qilish o‘rnini bosmaydi.

## Arxitektura va texnologiyalar

- **UI va Navigatsiya**: Jetpack Compose, Material 3 (Dynamic Color + yuqori kontrastli maritime-teal/navy palitra), Navigation Compose (`@Serializable` type-safe marshrutlar), `Noto Sans` & `Space Grotesk`.
- **Ma’lumotlar bazasi**: Room (SQLite + KSP) — 14 hudud, 16 kategoriya, 30 ta sintetik obyekt, tekshiruvlar, marshrutlar, murojaatlar, bildirishnomalar va offline sinxronlash navbati.
- **Sozlamalar va sessiya**: Jetpack DataStore Preferences (til: `uz` / `ru` / `en`, yorug‘/qorong‘i mavzu, faol hisob, offline rejim va 8 soatlik offline litsenziya muddati).
- **GIS va Geometriya**: Uzbekistan chegaralari, Orol/Aydarko‘l konturlari va GeoJSON (`Point` / `LineString` / `Polygon`) bilan ishlovchi interaktiv pan/zoom Canvas xaritasi, Haversine masofasi va marshrutdan og‘ish tekshiruvi.
- **Media tanlash**: Ruxsatsiz Android Photo Picker (`PickVisualMedia`) va Storage Access Framework (`OpenDocument`).

## Demo hisoblar (OTP kodi faqat debug versiyada ekranda ko‘rsatiladi)

| Rol | Telefon | Imkoniyatlar |
| --- | --- | --- |
| Fuqaro | `+998900000001` | Ommaviy xarita, murojaat yuborish va kuzatish |
| Xodim (ariza) | `+998900000002` | Kutilayotgan ariza holati (`pending_employee`) |
| Tekshirilgan xodim | `+998900000011` | Reyestr, 6 bosqichli obyekt qo‘shish, pasport, sinxronlash |
| Inspektor | `+998900000021` | Dala tekshiruvlari va gidrant o‘lchovlari |
| Ma’lumot tekshiruvchi | `+998900000031` | Qoralama/ko‘rib chiqilayotgan obyektlarni tasdiqlash va nashr qilish |
| Hudud rahbari | `+998900000041` | Tasdiqlangan operativ marshrutlar, murojaatlar holati |
| Tizim administratori | `+998900000099` | To‘liq boshqaruv va tasdiqlash oqimlari |

## Yig‘ish va ishga tushirish

- **Talablar**: JDK 21, Android SDK 36 (minSdk 24), AGP 9.1.1, Gradle 9.3.1.
- **Debug APK yig‘ish**:
  ```sh
  gradle assembleDebug
  ```
  Chiqish fayli: `app/build/outputs/apk/debug/app-debug.apk`.
