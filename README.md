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

## Serverga joylashtirish (Vercel + VPS)

Sayt Vercel'da, backend esa alohida serverda ishlaydi. Sayt API'ga to'g'ridan-to'g'ri `https://api.sizningdomen.uz` orqali murojaat qiladi. Shunda backend har bir foydalanuvchining haqiqiy IP manzilini ko'radi va so'rov limiti to'g'ri ishlaydi.

**1. Server.** Ubuntu 22.04 yoki 24.04, kamida 4 GB RAM va 40 GB disk. ClamAV kerak bo'lmasa, 2 GB RAM ham yetadi. Bunda `WITH_SCANNING=0` qo'ying.

**2. DNS.** `api.sizningdomen.uz` uchun server IP manziliga yo'naltirilgan `A` yozuv qo'shing. 80 va 443 portlar ochiq bo'lishi kerak.

**3. O'rnatish.** Serverda root sifatida bajaring:

```sh
curl -fsSLO https://raw.githubusercontent.com/asadbekistamov99-hash/fvv-gis/main/scripts/deploy-server.sh
API_DOMAIN=api.sizningdomen.uz ACME_EMAIL=siz@misol.uz bash deploy-server.sh
```

Skript Docker'ni o'rnatadi, kodni `/opt/fvv-gis` ga yuklaydi, sirlarni yaratadi, migratsiyalarni bajaradi, cheklangan huquqli bazaga kirish rollarini sozlaydi va xizmatlarni HTTPS bilan ishga tushiradi. Qayta ishga tushirish xavfsiz: mavjud parollar saqlanadi.

Qo'shimcha sozlamalar:

| O'zgaruvchi | Vazifasi |
| --- | --- |
| `WEB_ORIGIN` | Sayt manzili, standart: `https://hozak-nine.vercel.app` |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` | Eskiz SMS hisobi. Usiz hech kim tizimga kira olmaydi |
| `ADMIN_PHONE`, `ADMIN_NAME` | Birinchi administratorni yaratadi. Birinchi kirishda MFA majburiy |
| `WITH_SCANNING=0` | ClamAV'ni o'chiradi. Yuklangan fayllar karantinda qoladi |
| `BRANCH` | Joylashtiriladigan git branch, standart: `main` |

**4. Vercel.** Loyihaning production muhitiga ikkita o'zgaruvchi qo'shing va qayta deploy qiling:

```sh
VITE_API_URL=https://api.sizningdomen.uz/api/v1
VITE_MAP_STYLE_URL=https://api.sizningdomen.uz/tiles/style.json
```

**Muhim.** Production rejimda kirish va murojaatlar faqat Eskiz sozlangandan keyin ishlaydi. Haqiqiy murojaatlarni qabul qilish uchun yana operator ma'lumotlari va tasdiqlangan saqlash siyosati kerak, so'ng `LIVE_INTAKE_ENABLED=true` qo'yiladi. Bu himoya ataylab qilingan. Ommaviy xarita esa birinchi kundan ishlaydi.

## Production

To‘liq stack `scripts/compose` orqali ko‘tariladi. Gateway (Caddy) saytni, `/api` ni va `/tiles` ni bitta domendan beradi. Haqiqiy foydalanuvchilarni qabul qilishdan oldin kerak bo‘ladigan narsalar: domen va HTTPS, Eskiz SMS hisobi, operator ma’lumotlari va tasdiqlangan saqlash siyosati, S3 saqlash, ClamAV, ixtiyoriy Firebase. Tafsilotlar: [docs/OPERATIONS.md](docs/OPERATIONS.md).
