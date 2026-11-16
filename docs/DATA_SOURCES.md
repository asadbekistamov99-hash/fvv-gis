# Xarita va demo ma’lumotlarining kelib chiqishi

## Infratuzilma

`python -m app.cli seed-demo` faqat sintetik obyektlar yaratadi. Koordinatalar haqiqiy gidrant, quvur, gaz yoki elektr inshootining joylashuvi deb ko‘rsatilmaydi. Obyektlar va demo tumanlar `SINTETIK DEMO` bilan belgilanadi. Vakolatli production registrlari berilmagan.

14 birinchi darajali hudud nomlari va ISO kodlari ma’lumotnoma sifatida qo‘llanadi; bu joriy rasmiy hudud/tuman chegaralari haqidagi da’vo emas. Ma’muriy geometriyalarni import qilishdan oldin manbasi, sanasi, litsenziyasi va operator tasdig‘i saqlanishi kerak.

## Ochiq basemap

- Manba: [Geofabrik Uzbekistan](https://download.geofabrik.de/asia.html), `uzbekistan-shortbread-1.0.mbtiles`.
- Tekshirilgan nusxa: 321,519,616 bayt; SHA256 `0eb60ce67b9eedee26c005becb95f4d423f03e248cfcac8c6790850ae8645516`.
- Asosiy ma’lumot: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.
- Shortbread sxemasi: CC0; loyiha xarita uslubi `infrastructure/deployment/style.json`da.
- Mahalliy download manifesti `data/maps/manifest.json`ga yoziladi; data fayllari Gitga kiritilmaydi.

OSM atributsiyasi xaritada saqlanishi kerak. ODbL talablari bo‘yicha hosila ma’lumotlar tarqatilishi huquqiy ko‘rib chiqiladi. Maxfiy operativ obyektlar basemapga birlashtirilmaydi; ular server ruxsatlari va shifrlangan lokal kesh orqali alohida ko‘rsatiladi.

## Shrift

[Noto Sans](https://github.com/notofonts/noto-fonts) SIL Open Font License 1.1 ostida ishlatiladi. `scripts/fetch-map.py` TTF va OFL nusxasini `data/maps/fonts`ga joylaydi. Mobil/web distributivlari shriftni biriktirganda litsenziya matnini ham saqlashi kerak.

## Marshrutlar

OSRM uchun O‘zbekiston OSM PBF fayli Geofabrikdan olinadi; nusxaning sanasi va checksumini operator qayd etadi. `OSRM_SOURCE_DATE=unknown` tasdiqlangan operativ marshrut uchun yetarli hisoblanmaydi. OSM yo‘llari favqulodda sharoitda o‘tish mumkinligini yoki maxsus transportga mosligini kafolatlamaydi.

## Favqulodda aloqa ma’lumotlari

112, 101, 102, 103 va 104 bo‘yicha ma’lumotlar [O‘zbekiston Adliya vazirligining huquqiy maslahat sahifasi](https://advice.adliya.uz/oz/document/3256) bilan tekshirilgan. Reliz oldidan operator ularni qayta tekshiradi va manba sanasini yangilaydi. Ilovada mustaqil murojaat yuborilishi ushbu rasmiy xizmatlarga yetkazilganlikni anglatmaydi.
