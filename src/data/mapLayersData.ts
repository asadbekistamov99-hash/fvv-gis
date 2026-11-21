import {
  CyclingPathRoute,
  GeoPoint,
  ReliefPeakFeature,
  StreetViewPanorama,
  TrafficCongestionLevel,
  TrafficCorridor,
  TransitRouteLine,
  TransitStopPoint,
} from '../types/gis';

export function trafficColorHex(level: TrafficCongestionLevel): string {
  switch (level) {
    case 'free':
      return '#10B981'; // Emerald
    case 'moderate':
      return '#F59E0B'; // Amber
    case 'heavy':
      return '#EF4444'; // Red
    case 'jam':
      return '#991B1B'; // Deep crimson
  }
}

export const TRAFFIC_CORRIDORS: TrafficCorridor[] = [
  {
    id: 'tr_tashkent_amir_temur',
    nameUz: 'Amir Temur shoh ko‘chasi (Toshkent)',
    nameRu: 'Проспект Амира Темура (Ташкент)',
    nameEn: 'Amir Temur Avenue (Tashkent)',
    level: 'heavy',
    speedKmh: 22,
    points: [
      { lat: 41.3645, lon: 69.2882 },
      { lat: 41.3452, lon: 69.2848 },
      { lat: 41.3264, lon: 69.2825 },
      { lat: 41.3111, lon: 69.2797 },
      { lat: 41.2965, lon: 69.2762 },
    ],
  },
  {
    id: 'tr_tashkent_navoi',
    nameUz: 'Alisher Navoiy – Beruniy ko‘chasi',
    nameRu: 'Улица Алишера Навои – Беруни',
    nameEn: 'Alisher Navoi – Beruni Street',
    level: 'jam',
    speedKmh: 12,
    points: [
      { lat: 41.3372, lon: 69.2168 },
      { lat: 41.3282, lon: 69.2345 },
      { lat: 41.3215, lon: 69.2542 },
      { lat: 41.3186, lon: 69.2742 },
      { lat: 41.3148, lon: 69.2935 },
    ],
  },
  {
    id: 'tr_tashkent_bunyodkor',
    nameUz: 'Bunyodkor shoh ko‘chasi (Chilonzor)',
    nameRu: 'Проспект Бунёдкор (Чиланзар)',
    nameEn: 'Bunyodkor Avenue (Chilanzar)',
    level: 'moderate',
    speedKmh: 38,
    points: [
      { lat: 41.3135, lon: 69.2481 },
      { lat: 41.2982, lon: 69.2335 },
      { lat: 41.2814, lon: 69.2188 },
      { lat: 41.2642, lon: 69.2015 },
    ],
  },
  {
    id: 'tr_tashkent_shota',
    nameUz: 'Shota Rustaveli ko‘chasi (Yakkasaroy)',
    nameRu: 'Улица Шота Руставели (Яккасарай)',
    nameEn: 'Shota Rustaveli Street (Yakkasaray)',
    level: 'heavy',
    speedKmh: 24,
    points: [
      { lat: 41.3045, lon: 69.2715 },
      { lat: 41.2886, lon: 69.2612 },
      { lat: 41.2735, lon: 69.2478 },
      { lat: 41.2572, lon: 69.2361 },
    ],
  },
  {
    id: 'tr_tashkent_mkad_north',
    nameUz: 'Toshkent halqa yo‘li (Shimol–Sharq)',
    nameRu: 'Ташкентская кольцевая (Север–Восток)',
    nameEn: 'Tashkent Ring Road (North–East)',
    level: 'free',
    speedKmh: 68,
    points: [
      { lat: 41.3512, lon: 69.1885 },
      { lat: 41.3745, lon: 69.2452 },
      { lat: 41.3688, lon: 69.3182 },
      { lat: 41.3315, lon: 69.3545 },
      { lat: 41.2842, lon: 69.3422 },
    ],
  },
  {
    id: 'tr_tashkent_mustaqillik',
    nameUz: 'Mustaqillik shoh ko‘chasi',
    nameRu: 'Проспект Мустакиллик',
    nameEn: 'Mustaqillik Avenue',
    level: 'moderate',
    speedKmh: 42,
    points: [
      { lat: 41.3118, lon: 69.2812 },
      { lat: 41.3204, lon: 69.3025 },
      { lat: 41.3315, lon: 69.3272 },
      { lat: 41.3442, lon: 69.3518 },
    ],
  },
  {
    id: 'tr_m39_highway',
    nameUz: 'M39 avtomagistrali (Toshkent–Samarqand)',
    nameRu: 'Автомагистраль M39 (Ташкент–Самарканд)',
    nameEn: 'M39 Highway (Tashkent–Samarkand)',
    level: 'free',
    speedKmh: 92,
    points: [
      { lat: 41.258, lon: 69.198 },
      { lat: 40.824, lon: 68.712 },
      { lat: 40.492, lon: 68.782 },
      { lat: 40.115, lon: 67.842 },
      { lat: 39.718, lon: 67.084 },
      { lat: 39.654, lon: 66.968 },
    ],
  },
  {
    id: 'tr_kamchik_a373',
    nameUz: 'A373 Qamchiq dovoni trassasi',
    nameRu: 'Трасса A373 перевал Камчик',
    nameEn: 'A373 Kamchik Mountain Pass',
    level: 'moderate',
    speedKmh: 45,
    points: [
      { lat: 41.008, lon: 70.145 },
      { lat: 41.062, lon: 70.392 },
      { lat: 41.094, lon: 70.618 },
      { lat: 40.968, lon: 70.878 },
      { lat: 40.854, lon: 71.152 },
    ],
  },
  {
    id: 'tr_samarkand_registon',
    nameUz: 'Samarqand markazi (Registon – Mirzo Ulug‘bek)',
    nameRu: 'Центр Самарканда (Регистан – М. Улугбек)',
    nameEn: 'Samarkand Center (Registan – M. Ulugbek)',
    level: 'heavy',
    speedKmh: 25,
    points: [
      { lat: 39.6695, lon: 66.9355 },
      { lat: 39.6592, lon: 66.9585 },
      { lat: 39.6548, lon: 66.9757 },
      { lat: 39.6618, lon: 66.9922 },
    ],
  },
  {
    id: 'tr_bukhara_m37',
    nameUz: 'Buxoro halqa – Ibn Sino ko‘chasi',
    nameRu: 'Бухарское кольцо – ул. Ибн Сино',
    nameEn: 'Bukhara Ring – Ibn Sino Street',
    level: 'free',
    speedKmh: 62,
    points: [
      { lat: 39.7765, lon: 64.382 },
      { lat: 39.7745, lon: 64.4185 },
      { lat: 39.7662, lon: 64.448 },
      { lat: 39.749, lon: 64.462 },
    ],
  },
  {
    id: 'tr_fergana_valley',
    nameUz: 'Farg‘ona – Marg‘ilon – Qo‘qon magistrali',
    nameRu: 'Магистраль Фергана – Маргилан – Коканд',
    nameEn: 'Fergana – Margilan – Kokand Corridor',
    level: 'moderate',
    speedKmh: 58,
    points: [
      { lat: 40.528, lon: 70.942 },
      { lat: 40.472, lon: 71.385 },
      { lat: 40.468, lon: 71.718 },
      { lat: 40.386, lon: 71.786 },
      { lat: 40.625, lon: 72.185 },
      { lat: 40.782, lon: 72.344 },
    ],
  },
];

export const TRANSIT_LINES: TransitRouteLine[] = [
  {
    id: 'metro_chilonzor',
    nameUz: 'Toshkent Metropoliteni · Chilonzor yo‘li',
    nameRu: 'Ташкентский метрополитен · Чиланзарская линия',
    nameEn: 'Tashkent Metro · Chilanzar Line',
    mode: 'metro',
    colorHex: '#EF4444',
    points: [
      { lat: 41.2588, lon: 69.1932 },
      { lat: 41.2742, lon: 69.2055 },
      { lat: 41.2886, lon: 69.2192 },
      { lat: 41.3046, lon: 69.2368 },
      { lat: 41.3121, lon: 69.2542 },
      { lat: 41.3156, lon: 69.2798 },
      { lat: 41.3268, lon: 69.3105 },
      { lat: 41.3378, lon: 69.3385 },
    ],
  },
  {
    id: 'metro_uzbekistan',
    nameUz: 'Toshkent Metropoliteni · O‘zbekiston yo‘li',
    nameRu: 'Ташкентский метрополитен · Узбекистанская линия',
    nameEn: 'Tashkent Metro · Uzbekistan Line',
    mode: 'metro',
    colorHex: '#2563EB',
    points: [
      { lat: 41.3452, lon: 69.2064 },
      { lat: 41.3304, lon: 69.2258 },
      { lat: 41.3208, lon: 69.2422 },
      { lat: 41.3136, lon: 69.2618 },
      { lat: 41.3042, lon: 69.2778 },
      { lat: 41.2925, lon: 69.2865 },
      { lat: 41.2865, lon: 69.3182 },
    ],
  },
  {
    id: 'metro_yunusobod',
    nameUz: 'Toshkent Metropoliteni · Yunusobod yo‘li',
    nameRu: 'Ташкентский метрополитен · Юнусабадская линия',
    nameEn: 'Tashkent Metro · Yunusabad Line',
    mode: 'metro',
    colorHex: '#10B981',
    points: [
      { lat: 41.3752, lon: 69.2908 },
      { lat: 41.3585, lon: 69.2882 },
      { lat: 41.3396, lon: 69.2845 },
      { lat: 41.3245, lon: 69.2812 },
      { lat: 41.3145, lon: 69.2798 },
      { lat: 41.2982, lon: 69.2768 },
    ],
  },
  {
    id: 'metro_circle',
    nameUz: 'Yer usti halqa metro yo‘li (30 yillik)',
    nameRu: 'Надземная кольцевая линия метро',
    nameEn: 'Elevated Circle Metro Line',
    mode: 'metro',
    colorHex: '#F59E0B',
    points: [
      { lat: 41.2865, lon: 69.3182 },
      { lat: 41.2752, lon: 69.3395 },
      { lat: 41.2584, lon: 69.3422 },
      { lat: 41.2362, lon: 69.3185 },
      { lat: 41.2255, lon: 69.2645 },
      { lat: 41.2248, lon: 69.2185 },
    ],
  },
  {
    id: 'rail_afrosiyob',
    nameUz: 'Afrosiyob tezyurar temir yo‘li (Toshkent–Buxoro–Xiva)',
    nameRu: 'Скоростная ж/д Афросиаб (Ташкент–Бухара–Хива)',
    nameEn: 'Afrosiyob High-Speed Rail',
    mode: 'rail',
    colorHex: '#0284C7',
    points: [
      { lat: 41.2925, lon: 69.2865 },
      { lat: 40.495, lon: 68.788 },
      { lat: 40.118, lon: 67.848 },
      { lat: 39.685, lon: 66.929 },
      { lat: 40.103, lon: 65.368 },
      { lat: 39.718, lon: 64.542 },
      { lat: 41.375, lon: 60.365 },
    ],
  },
];

export const TRANSIT_STATIONS: TransitStopPoint[] = [
  {
    id: 'st_chorsu',
    lineId: 'metro_uzbekistan',
    nameUz: 'Chorsu metro bekati',
    nameRu: 'Станция метро Чорсу',
    nameEn: 'Chorsu Metro Station',
    mode: 'metro',
    colorHex: '#2563EB',
    point: { lat: 41.3258, lon: 69.2348 },
  },
  {
    id: 'st_amir_temur',
    lineId: 'metro_chilonzor',
    nameUz: 'Amir Temur xiyoboni (Almashuv)',
    nameRu: 'Сквер Амира Темура (Пересадка)',
    nameEn: 'Amir Temur Xiyoboni (Hub)',
    mode: 'metro',
    colorHex: '#EF4444',
    point: { lat: 41.3126, lon: 69.2804 },
  },
  {
    id: 'st_paxtakor',
    lineId: 'metro_uzbekistan',
    nameUz: 'Paxtakor / Alisher Navoiy',
    nameRu: 'Пахтакор / Алишер Навои',
    nameEn: 'Pakhtakor / Alisher Navoi',
    mode: 'metro',
    colorHex: '#2563EB',
    point: { lat: 41.3156, lon: 69.2542 },
  },
  {
    id: 'st_chilonzor',
    lineId: 'metro_chilonzor',
    nameUz: 'Chilonzor metro bekati',
    nameRu: 'Станция метро Чиланзар',
    nameEn: 'Chilanzar Metro Station',
    mode: 'metro',
    colorHex: '#EF4444',
    point: { lat: 41.2742, lon: 69.2055 },
  },
  {
    id: 'st_tashkent_rail',
    lineId: 'rail_afrosiyob',
    nameUz: 'Toshkent Shimoliy vokzali',
    nameRu: 'Вокзал Ташкент-Центральный',
    nameEn: 'Tashkent Central Railway Station',
    mode: 'rail',
    colorHex: '#0284C7',
    point: { lat: 41.2925, lon: 69.2865 },
  },
  {
    id: 'st_samarkand_rail',
    lineId: 'rail_afrosiyob',
    nameUz: 'Samarqand temir yo‘l vokzali',
    nameRu: 'Вокзал Самарканд',
    nameEn: 'Samarkand Railway Station',
    mode: 'rail',
    colorHex: '#0284C7',
    point: { lat: 39.6852, lon: 66.9292 },
  },
  {
    id: 'st_bukhara_rail',
    lineId: 'rail_afrosiyob',
    nameUz: 'Buxoro-1 (Kogon) vokzali',
    nameRu: 'Вокзал Бухара-1 (Каган)',
    nameEn: 'Bukhara-1 Railway Station',
    mode: 'rail',
    colorHex: '#0284C7',
    point: { lat: 39.718, lon: 64.542 },
  },
  {
    id: 'st_khiva_rail',
    lineId: 'rail_afrosiyob',
    nameUz: 'Xiva vokzali',
    nameRu: 'Вокзал Хива',
    nameEn: 'Khiva Railway Station',
    mode: 'rail',
    colorHex: '#0284C7',
    point: { lat: 41.3755, lon: 60.3695 },
  },
];

export const CYCLING_ROUTES: CyclingPathRoute[] = [
  {
    id: 'cyc_anhor',
    nameUz: 'Anhor kanali bo‘ylab veloyo‘lak',
    nameRu: 'Велодорожка вдоль канала Анхор',
    nameEn: 'Anhor Canal Greenway Cycle Path',
    distanceKm: 7.4,
    points: [
      { lat: 41.3338, lon: 69.2712 },
      { lat: 41.3245, lon: 69.2665 },
      { lat: 41.3145, lon: 69.2632 },
      { lat: 41.3048, lon: 69.2572 },
      { lat: 41.2975, lon: 69.2475 },
    ],
  },
  {
    id: 'cyc_ecopark',
    nameUz: 'Markaziy Eko-bog‘ – Bodomzor aylanma yo‘li',
    nameRu: 'Велокольцо Эко-парк – Бадамзар',
    nameEn: 'Central Eco-Park Cycle Loop',
    distanceKm: 5.8,
    points: [
      { lat: 41.3182, lon: 69.2912 },
      { lat: 41.3278, lon: 69.2985 },
      { lat: 41.3412, lon: 69.2915 },
      { lat: 41.3375, lon: 69.2825 },
      { lat: 41.3182, lon: 69.2912 },
    ],
  },
  {
    id: 'cyc_samarkand',
    nameUz: 'Samarqand Universitet xiyoboni – Registon veloyo‘li',
    nameRu: 'Университетский бульвар – Регистан',
    nameEn: 'Samarkand University Blvd Cycle Route',
    distanceKm: 4.9,
    points: [
      { lat: 39.6472, lon: 66.9532 },
      { lat: 39.6512, lon: 66.9635 },
      { lat: 39.6548, lon: 66.9757 },
      { lat: 39.6615, lon: 66.9852 },
    ],
  },
  {
    id: 'cyc_bukhara',
    nameUz: 'Labihovuz – Somoniylar bog‘i veloyo‘li',
    nameRu: 'Ляби-Хауз – Парк Саманидов',
    nameEn: 'Lyabi-Hauz to Samanids Park Path',
    distanceKm: 3.6,
    points: [
      { lat: 39.7731, lon: 64.4209 },
      { lat: 39.7768, lon: 64.4112 },
      { lat: 39.7755, lon: 64.4005 },
      { lat: 39.7695, lon: 64.4042 },
    ],
  },
];

function createContourCircle(lat: number, lon: number, radiusLat: number, radiusLon: number): GeoPoint[] {
  const pts: GeoPoint[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.12 * Math.sin(a * 3) + 0.08 * Math.cos(a * 2);
    pts.push({
      lat: lat + Math.sin(a) * radiusLat * wobble,
      lon: lon + Math.cos(a) * radiusLon * wobble,
    });
  }
  return pts;
}

export const RELIEF_PEAKS: ReliefPeakFeature[] = [
  {
    id: 'peak_hazrati_sulton',
    nameUz: 'Hazrati Sulton cho‘qqisi (4643 m)',
    nameRu: 'Пик Хазрати Султан (4643 м)',
    nameEn: 'Khazret Sultan Peak (4643 m)',
    elevationM: 4643,
    point: { lat: 38.948, lon: 68.172 },
    contourRing: createContourCircle(38.948, 68.172, 0.36, 0.48),
  },
  {
    id: 'peak_chimgan',
    nameUz: 'Katta Chimyon tog‘i (3309 m)',
    nameRu: 'Большой Чимган (3309 м)',
    nameEn: 'Greater Chimgan (3309 m)',
    elevationM: 3309,
    point: { lat: 41.495, lon: 70.058 },
    contourRing: createContourCircle(41.495, 70.058, 0.28, 0.38),
  },
  {
    id: 'peak_kamchik',
    nameUz: 'Qamchiq dovoni (2268 m)',
    nameRu: 'Перевал Камчик (2268 м)',
    nameEn: 'Kamchik Pass (2268 m)',
    elevationM: 2268,
    point: { lat: 41.094, lon: 70.618 },
    contourRing: createContourCircle(41.094, 70.618, 0.24, 0.34),
  },
  {
    id: 'peak_nurota',
    nameUz: 'Nurota tog‘ tizmasi (2169 m)',
    nameRu: 'Хребет Нуратау (2169 м)',
    nameEn: 'Nuratau Range (2169 m)',
    elevationM: 2169,
    point: { lat: 40.558, lon: 66.752 },
    contourRing: createContourCircle(40.558, 66.752, 0.32, 0.55),
  },
  {
    id: 'peak_babatag',
    nameUz: 'Bobotog‘ tizmasi (2290 m)',
    nameRu: 'Хребет Бабатаг (2290 м)',
    nameEn: 'Babatag Ridge (2290 m)',
    elevationM: 2290,
    point: { lat: 38.012, lon: 68.145 },
    contourRing: createContourCircle(38.012, 68.145, 0.3, 0.32),
  },
  {
    id: 'peak_ustyurt',
    nameUz: 'Ustyurt platosi chinki (365 m)',
    nameRu: 'Чинк плато Устюрт (365 м)',
    nameEn: 'Ustyurt Plateau Escarpment (365 m)',
    elevationM: 365,
    point: { lat: 43.25, lon: 58.25 },
    contourRing: createContourCircle(43.25, 58.25, 0.65, 0.95),
  },
];

export const STREET_VIEW_CORRIDORS: GeoPoint[][] = [
  // Tashkent central street-view corridors
  [
    { lat: 41.365, lon: 69.288 },
    { lat: 41.3111, lon: 69.2797 },
    { lat: 41.2735, lon: 69.2478 },
  ],
  [
    { lat: 41.337, lon: 69.217 },
    { lat: 41.3215, lon: 69.2542 },
    { lat: 41.3118, lon: 69.2812 },
    { lat: 41.335, lon: 69.335 },
  ],
  [
    { lat: 41.3135, lon: 69.2481 },
    { lat: 41.2742, lon: 69.2055 },
  ],
  // Samarkand
  [
    { lat: 39.671, lon: 66.935 },
    { lat: 39.6548, lon: 66.9757 },
    { lat: 39.662, lon: 66.995 },
  ],
  // Bukhara
  [
    { lat: 39.777, lon: 64.395 },
    { lat: 39.7747, lon: 64.4112 },
    { lat: 39.7731, lon: 64.4209 },
  ],
  // Khiva
  [
    { lat: 41.382, lon: 60.351 },
    { lat: 41.3782, lon: 60.3596 },
    { lat: 41.3755, lon: 60.3695 },
  ],
  // Fergana & Andijan
  [
    { lat: 40.386, lon: 71.786 },
    { lat: 40.468, lon: 71.718 },
    { lat: 40.782, lon: 72.344 },
  ],
  // Nukus
  [
    { lat: 42.468, lon: 59.601 },
    { lat: 42.462, lon: 59.616 },
    { lat: 42.456, lon: 59.631 },
  ],
];

export const STREET_VIEW_PANORAMAS: StreetViewPanorama[] = [
  {
    id: 'sv_amir_temur',
    titleUz: 'Amir Temur xiyoboni',
    titleRu: 'Сквер Амира Темура',
    titleEn: 'Amir Temur Square',
    subtitleUz: 'Toshkent markazi · Shoh ko‘cha',
    subtitleRu: 'Центр Ташкента · Проспект',
    subtitleEn: 'Central Tashkent · Boulevard',
    regionId: 'tashkent_city',
    point: { lat: 41.3111, lon: 69.2797 },
    defaultHeadingDeg: 25,
    palette: {
      skyTop: '#2563EB',
      skyBottom: '#BAE6FD',
      horizon: '#64748B',
      ground: '#334155',
      accent: '#FBBF24',
    },
    landmarks: [
      { bearingDeg: 15, labelUz: 'O‘zbekiston mehmonxonasi', labelRu: 'Гостиница Узбекистан', labelEn: 'Hotel Uzbekistan', kind: 'building' },
      { bearingDeg: 105, labelUz: 'Forumlar saroyi', labelRu: 'Дворец форумов', labelEn: 'Palace of Forums', kind: 'dome' },
      { bearingDeg: 215, labelUz: 'Kurantlar minorasi', labelRu: 'Ташкентские куранты', labelEn: 'Tashkent Chimes Tower', kind: 'tower' },
      { bearingDeg: 310, labelUz: 'Xiyobon daraxtzori', labelRu: 'Парковая аллея', labelEn: 'Square Park', kind: 'park' },
    ],
  },
  {
    id: 'sv_chorsu',
    titleUz: 'Chorsu maydoni · Eski shahar',
    titleRu: 'Площадь Чорсу · Старый город',
    titleEn: 'Chorsu Square · Old City',
    subtitleUz: 'Toshkent · Gumbazli bozor',
    subtitleRu: 'Ташкент · Купол базара',
    subtitleEn: 'Tashkent · Historic Dome',
    regionId: 'tashkent_city',
    point: { lat: 41.3267, lon: 69.2351 },
    defaultHeadingDeg: 60,
    palette: {
      skyTop: '#0284C7',
      skyBottom: '#E0F2FE',
      horizon: '#94A3B8',
      ground: '#475569',
      accent: '#06B6D4',
    },
    landmarks: [
      { bearingDeg: 45, labelUz: 'Chorsu moviy gumbazi', labelRu: 'Голубой купол Чорсу', labelEn: 'Chorsu Blue Dome', kind: 'dome' },
      { bearingDeg: 165, labelUz: 'Ko‘kaldosh madrasasi', labelRu: 'Медресе Кукельдаш', labelEn: 'Kukeldash Madrasah', kind: 'arch' },
      { bearingDeg: 270, labelUz: 'Zar qaynar ko‘chasi', labelRu: 'Улица Заркайнар', labelEn: 'Zarkaynar Street', kind: 'building' },
    ],
  },
  {
    id: 'sv_tashkent_city',
    titleUz: 'Toshkent City · Xalqaro markaz',
    titleRu: 'Tashkent City · Деловой центр',
    titleEn: 'Tashkent City · Business District',
    subtitleUz: 'Toshkent · Islom Karimov ko‘chasi',
    subtitleRu: 'Ташкент · Проспект И. Каримова',
    subtitleEn: 'Tashkent · Financial Plaza',
    regionId: 'tashkent_city',
    point: { lat: 41.3145, lon: 69.2478 },
    defaultHeadingDeg: 335,
    palette: {
      skyTop: '#1D4ED8',
      skyBottom: '#DBEAFE',
      horizon: '#475569',
      ground: '#1E293B',
      accent: '#38BDF8',
    },
    landmarks: [
      { bearingDeg: 340, labelUz: 'Nest One minorasi', labelRu: 'Башня Nest One', labelEn: 'Nest One Skyscraper', kind: 'tower' },
      { bearingDeg: 85, labelUz: 'Kongress-holl', labelRu: 'Конгресс-холл', labelEn: 'Congress Hall', kind: 'building' },
      { bearingDeg: 205, labelUz: 'Markaziy favvora bog‘i', labelRu: 'Парк с фонтанами', labelEn: 'Central Fountain Park', kind: 'park' },
    ],
  },
  {
    id: 'sv_samarkand_registan',
    titleUz: 'Registon maydoni',
    titleRu: 'Площадь Регистан',
    titleEn: 'Registan Square',
    subtitleUz: 'Samarqand · Tarixiy ansambl',
    subtitleRu: 'Самарканд · Исторический ансамбль',
    subtitleEn: 'Samarkand · UNESCO Ensemble',
    regionId: 'samarkand',
    point: { lat: 39.6548, lon: 66.9757 },
    defaultHeadingDeg: 0,
    palette: {
      skyTop: '#0369A1',
      skyBottom: '#FEF3C7',
      horizon: '#B45309',
      ground: '#57534E',
      accent: '#2DD4BF',
    },
    landmarks: [
      { bearingDeg: 350, labelUz: 'Tillakori madrasasi', labelRu: 'Медресе Тилля-Кари', labelEn: 'Tilya-Kori Madrasah', kind: 'arch' },
      { bearingDeg: 85, labelUz: 'Sherdor madrasasi', labelRu: 'Медресе Шердор', labelEn: 'Sher-Dor Madrasah', kind: 'dome' },
      { bearingDeg: 270, labelUz: 'Mirzo Ulug‘bek madrasasi', labelRu: 'Медресе Улугбека', labelEn: 'Ulugh Beg Madrasah', kind: 'tower' },
    ],
  },
  {
    id: 'sv_bukhara_ark',
    titleUz: 'Buxoro Arki va Poi Kalon',
    titleRu: 'Арк Бухары и Пои-Калян',
    titleEn: 'Bukhara Ark & Poi Kalyan',
    subtitleUz: 'Buxoro · Qadimiy qal’a',
    subtitleRu: 'Бухара · Древняя цитадель',
    subtitleEn: 'Bukhara · Ancient Citadel',
    regionId: 'bukhara',
    point: { lat: 39.7779, lon: 64.4109 },
    defaultHeadingDeg: 90,
    palette: {
      skyTop: '#0EA5E9',
      skyBottom: '#FDE68A',
      horizon: '#92400E',
      ground: '#78716C',
      accent: '#F59E0B',
    },
    landmarks: [
      { bearingDeg: 90, labelUz: 'Buxoro Arki devori', labelRu: 'Крепость Арк', labelEn: 'Ark Fortress Wall', kind: 'arch' },
      { bearingDeg: 145, labelUz: 'Minorai Kalon', labelRu: 'Минарет Калян', labelEn: 'Kalyan Minaret', kind: 'tower' },
      { bearingDeg: 250, labelUz: 'Bolo Hovuz masjidi', labelRu: 'Мечеть Боло-Хауз', labelEn: 'Bolo Haouz Mosque', kind: 'park' },
    ],
  },
  {
    id: 'sv_khiva_ichan',
    titleUz: 'Ichan Qal’a · Kalta Minor',
    titleRu: 'Ичан-Кала · Кальта-Минор',
    titleEn: 'Ichan Kala · Kalta Minor',
    subtitleUz: 'Xiva · Xorazm viloyati',
    subtitleRu: 'Хива · Хорезмская область',
    subtitleEn: 'Khiva · Khorezm Region',
    regionId: 'khorezm',
    point: { lat: 41.3782, lon: 60.3596 },
    defaultHeadingDeg: 110,
    palette: {
      skyTop: '#0284C7',
      skyBottom: '#FEF9C3',
      horizon: '#A16207',
      ground: '#6B5E4E',
      accent: '#14B8A6',
    },
    landmarks: [
      { bearingDeg: 110, labelUz: 'Kalta Minor minorasi', labelRu: 'Минарет Кальта-Минор', labelEn: 'Kalta Minor Minaret', kind: 'tower' },
      { bearingDeg: 195, labelUz: 'Ko‘hna Ark darvozasi', labelRu: 'Ворота Куня-Арк', labelEn: 'Kunya-Ark Gate', kind: 'arch' },
      { bearingDeg: 25, labelUz: 'Juma masjidi', labelRu: 'Мечеть Джума', labelEn: 'Juma Mosque', kind: 'dome' },
    ],
  },
  {
    id: 'sv_chimgan_pass',
    titleUz: 'Chimyon · Amirsoy tog‘ yo‘li',
    titleRu: 'Чимган · Горная трасса Амирсой',
    titleEn: 'Chimgan · Mountain Highway',
    subtitleUz: 'Toshkent viloyati · G‘arbiy Tyan-Shan',
    subtitleRu: 'Ташкентская обл. · Тянь-Шань',
    subtitleEn: 'Tashkent Region · Tian Shan',
    regionId: 'tashkent_region',
    point: { lat: 41.498, lon: 70.032 },
    defaultHeadingDeg: 80,
    palette: {
      skyTop: '#1E40AF',
      skyBottom: '#E0F2FE',
      horizon: '#3F6212',
      ground: '#374151',
      accent: '#22C55E',
    },
    landmarks: [
      { bearingDeg: 75, labelUz: 'Katta Chimyon cho‘qqisi (3309 m)', labelRu: 'Пик Большой Чимган', labelEn: 'Greater Chimgan Peak', kind: 'mountain' },
      { bearingDeg: 170, labelUz: 'Chorvoq suv ombori manzarasi', labelRu: 'Чарвакское водохранилище', labelEn: 'Charvak Reservoir Vista', kind: 'park' },
      { bearingDeg: 310, labelUz: 'Bo‘stonliq qutqaruv punkti', labelRu: 'Спасательный пост Бостанлык', labelEn: 'Bostanlyk Rescue Post', kind: 'building' },
    ],
  },
  {
    id: 'sv_fergana_park',
    titleUz: 'Farg‘ona Markaziy xiyoboni',
    titleRu: 'Центральный парк Ферганы',
    titleEn: 'Fergana Central Boulevard',
    subtitleUz: 'Farg‘ona shahri · Al-Farg‘oniy',
    subtitleRu: 'Фергана · Ул. Аль-Фергани',
    subtitleEn: 'Fergana · Al-Fergani Ave',
    regionId: 'fergana',
    point: { lat: 40.3864, lon: 71.7864 },
    defaultHeadingDeg: 45,
    palette: {
      skyTop: '#0284C7',
      skyBottom: '#DCFCE7',
      horizon: '#15803D',
      ground: '#334155',
      accent: '#10B981',
    },
    landmarks: [
      { bearingDeg: 40, labelUz: 'Ahmad al-Farg‘oniy bog‘i', labelRu: 'Парк Аль-Фергани', labelEn: 'Al-Fergani Memorial Park', kind: 'park' },
      { bearingDeg: 155, labelUz: 'Farg‘ona teatr maydoni', labelRu: 'Театральная площадь', labelEn: 'Theater Square', kind: 'building' },
    ],
  },
  {
    id: 'sv_nukus_savitsky',
    titleUz: 'Nukus · Savitskiy muzeyi maydoni',
    titleRu: 'Нукус · Площадь музея Савицкого',
    titleEn: 'Nukus · Savitsky Museum Plaza',
    subtitleUz: 'Qoraqalpog‘iston · R. Berdax ko‘chasi',
    subtitleRu: 'Каракалпакстан · Ул. Бердаха',
    subtitleEn: 'Karakalpakstan · Berdakh St',
    regionId: 'karakalpakstan',
    point: { lat: 42.4648, lon: 59.6122 },
    defaultHeadingDeg: 130,
    palette: {
      skyTop: '#0369A1',
      skyBottom: '#F1F5F9',
      horizon: '#64748B',
      ground: '#475569',
      accent: '#38BDF8',
    },
    landmarks: [
      { bearingDeg: 120, labelUz: 'Savitskiy san’at muzeyi', labelRu: 'Музей искусств им. Савицкого', labelEn: 'Savitsky Art Museum', kind: 'building' },
      { bearingDeg: 260, labelUz: 'Do‘stlik kanali ko‘prigi', labelRu: 'Мост через канал Достлик', labelEn: 'Dostlik Canal Bridge', kind: 'arch' },
    ],
  },
];

export function buildStreetViewForPoint(point: GeoPoint): StreetViewPanorama {
  // Snap to nearest known panorama if within ~2 km, else build dynamic corridor panorama
  let best = STREET_VIEW_PANORAMAS[0];
  let bestDistSq = Infinity;
  for (const pano of STREET_VIEW_PANORAMAS) {
    const d = (pano.point.lat - point.lat) ** 2 + (pano.point.lon - point.lon) ** 2;
    if (d < bestDistSq) {
      bestDistSq = d;
      best = pano;
    }
  }
  if (bestDistSq < 0.0006) {
    return best;
  }
  return {
    id: `sv_custom_${point.lat.toFixed(4)}_${point.lon.toFixed(4)}`,
    titleUz: `Ko‘cha panoramasi · ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E`,
    titleRu: `Панорама улицы · ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E`,
    titleEn: `Street Panorama · ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E`,
    subtitleUz: `${best.titleUz} yaqinida`,
    subtitleRu: `Рядом с: ${best.titleRu}`,
    subtitleEn: `Near ${best.titleEn}`,
    regionId: best.regionId,
    point,
    defaultHeadingDeg: 0,
    palette: best.palette,
    landmarks: [
      {
        bearingDeg: 25,
        labelUz: 'Asosiy avtomobil yo‘li',
        labelRu: 'Основная проезжая часть',
        labelEn: 'Main Roadway Corridor',
        kind: 'building',
      },
      {
        bearingDeg: 150,
        labelUz: 'Muhandislik tarmoqlari yo‘lagi',
        labelRu: 'Коридор инженерных сетей',
        labelEn: 'Utility Infrastructure Corridor',
        kind: 'tower',
      },
      {
        bearingDeg: 280,
        labelUz: `${best.titleUz} yo‘nalishi`,
        labelRu: `Направление: ${best.titleRu}`,
        labelEn: `Towards ${best.titleEn}`,
        kind: 'park',
      },
    ],
  };
}
