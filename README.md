# FVV GIS Uzbekistan

O‘zbekiston uchun mustaqil GIS va infratuzilma reyestri platformasi. Loyiha **bitta veb-sayt** va uning orqasidagi API’dan iborat. Mobil ilovalar olib tashlangan: sayt telefon, planshet va kompyuter brauzerida ishlaydi.

**Mustaqil loyiha · Rasmiy davlat ilovasi emas.** Rasmiy tasdiq, davlat gerbi yoki dispetcherlik integratsiyasi mavjud deb da’vo qilinmaydi. Sinov yozuvlari `SINTETIK` deb belgilanadi. Murojaat yuborish `112` ga qo‘ng‘iroq qilish o‘rnini bosmaydi.

## Sayt kimlar uchun

| Foydalanuvchi | Imkoniyatlar |
| --- | --- |
| Mehmon (kirishsiz) | Ommaviy xarita, hudud/kategoriya/holat filtri, 112 eslatmasi |
| Fuqaro | Murojaat yuborish (joylashuv va fayl bilan), o‘z murojaatlarini kuzatish, bildirishnomalar, profil |
| Xodim arizachisi | Fuqaro imkoniyatlari va ariza holati |
| Tekshirilgan xodim | Operativ xarita, reyestr, obyekt pasporti, tekshiruvlar, marshrutlar |
| Tekshiruvchi / rahbar | Tasdiqlash, nashr qilish, murojaatlarni boshqarish |
| Administrator | Xodimlarni tasdiqlash, rollar, audit, sozlamalar (MFA bilan) |

Kirish usullari: SMS kod, telefon va parol, ro‘yxatdan o‘tish. Administratorlar faqat SMS kod va MFA orqali kiradi.

## Tuzilma

```
apps/web/        React + TypeScript + Vite + MapLibre sayti
services/api/    FastAPI + PostgreSQL/PostGIS API, Alembic migratsiyalari, testlar
infrastructure/  Docker Compose, Caddy gateway, Martin tile server sozlamalari
scripts/         Muhitni tayyorlash, zaxira nusxa, tiklash, xarita yuklash
docs/            Foydalanish qo‘llanmasi, operatsiyalar, OpenAPI, test natijalari
```

## Mahalliy ishga tushirish

Talablar: Python 3.12 yoki 3.13, `uv`, Node.js 24, PostgreSQL 16+ va PostGIS.

API:

```sh
python scripts/init-env.py
scripts/dev-api
```

Sayt (boshqa terminalda):

```sh
cd apps/web
npm ci
npm run dev
```

Sayt `http://localhost:5173` da ochiladi va `/api` so‘rovlarini `127.0.0.1:8000` dagi API’ga yo‘naltiradi. Development rejimida SMS yuborilmaydi: test kodi ekranda ko‘rsatiladi.

## Tekshirish

```sh
cd services/api && uv run alembic upgrade head && uv run pytest -q
cd apps/web && npm test && npm run build
python scripts/test_operations.py
```

## Production

To‘liq stack `scripts/compose` orqali ko‘tariladi. Gateway (Caddy) saytni, `/api` ni va `/tiles` ni bitta domendan beradi. Haqiqiy foydalanuvchilarni qabul qilishdan oldin kerak bo‘ladigan narsalar: domen va HTTPS, Eskiz SMS hisobi, operator ma’lumotlari va tasdiqlangan saqlash siyosati, S3 saqlash, ClamAV, ixtiyoriy Firebase. Tafsilotlar: [docs/OPERATIONS.md](docs/OPERATIONS.md).
