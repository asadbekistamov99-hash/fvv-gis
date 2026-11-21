# FVV GIS Uzbekistan (Web)

O‘zbekiston uchun mustaqil ishlab chiqilgan **React + TypeScript + Vite + Tailwind CSS** asosidagi offline-first GIS va infratuzilma reyestri veb-ilovasi. Fuqarolar ommaviy xarita va shoshilinch bo‘lmagan murojaatlardan foydalanadi; tekshirilgan xodimlar ruxsatga asoslangan operativ yozuvlar, tekshiruvlar, marshrutlar va sinxronlash navbati bilan ishlaydi.

**Mustaqil loyiha · Rasmiy davlat ilovasi emas.** Rasmiy tasdiq, davlat gerbi yoki dispetcherlik integratsiyasi mavjud deb da’vo qilinmaydi. Sinov yozuvlari `SINTETIK DEMO` deb belgilanadi. Murojaat yuborish `112` yoki shoshilinch xizmatlarga qo‘ng‘iroq qilish o‘rnini bosmaydi.

## Arxitektura va texnologiyalar

- **UI va Navigatsiya**: React 19, TypeScript, Tailwind CSS v4 (yuqori kontrastli maritime-teal/navy palitra, yorug‘/qorong‘i mavzu), Lucide ikonkalari, `Noto Sans` & `Space Grotesk` shriftlari (`uz` / `ru` / `en`).
- **Xarita va GIS**: `maplibre-gl` (OpenFreeMap / OpenStreetMap vektor tayllari) va offline rejim yoki tayl yuklanmaganda avtomatik ishga tushadigan interaktiv HTML5 Canvas kontur xaritasi (14 viloyat, Orol/Aydarko‘l konturlari, proksimallik klasterlash, chiziq/poligon geometriyalar, masofa o‘lchash, tezkor pin qo‘yish, A* maxsus texnika marshrutlash, offline tayl hududini rejalashtirish).
- **Saqlash va offline-first**: Brauzer `localStorage` (`fvv_gis_db_v1`) — 14 hudud, 16 kategoriya, 30 ta sintetik obyekt, tekshiruvlar, marshrutlar, murojaatlar, bildirishnomalar, qoralamalar, offline hududlar, 8 soatlik xodim operativ ruxsati va 409 konflikt yechimi bilan navbat.
- **Geolokatsiya**: Brauzer Geolocation API (timeout/rad etish holatida Toshkent koordinatalariga zaxira qaytish bilan).

## Demo hisoblar (OTP: `123456`)

| Rol | Telefon | Imkoniyatlar |
| --- | --- | --- |
| Fuqaro | `+998900000001` | Ommaviy xarita, murojaat yuborish va kuzatish |
| Xodim (ariza) | `+998900000002` | Kutilayotgan ariza holati (`pending_employee`) |
| Tekshirilgan xodim | `+998900000011` | Reyestr, 6 bosqichli obyekt qo‘shish, pasport, sinxronlash |
| Inspektor | `+998900000013` / `+998900000021` | Dala tekshiruvlari va ma’lumotlar nazorati |
| Hudud rahbari | `+998900000031` | Obyekt va operativ marshrutlarni tasdiqlash |
| Tizim administratori | `+998900000099` | To‘liq boshqaruv va tasdiqlash oqimlari |

## Yig‘ish va ishga tushirish

```sh
npm install
npm run dev       # Vite dev server (0.0.0.0:3000)
npm run build     # TypeScript + Vite production build
npm run lint      # ESLint tekshiruvi
```
