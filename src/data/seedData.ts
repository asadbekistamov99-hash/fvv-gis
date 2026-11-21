import {
  ApprovedRouteEntity,
  CategoryEntity,
  CitizenReportEntity,
  InfrastructureObjectEntity,
  InspectionEntity,
  NotificationEntity,
  RegionEntity,
  UserAccountEntity,
} from '../types/gis';
import { GeoUtils } from '../core/geoUtils';

function isoUtcDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400_000);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export const SeedData = {
  regions: [
    { id: 'UZ-AN', nameUz: 'Andijon viloyati', nameRu: 'Андижанская область', nameEn: 'Andijan', centerLat: 40.782, centerLon: 72.344 },
    { id: 'UZ-BU', nameUz: 'Buxoro viloyati', nameRu: 'Бухарская область', nameEn: 'Bukhara', centerLat: 39.775, centerLon: 64.421 },
    { id: 'UZ-FA', nameUz: 'Farg‘ona viloyati', nameRu: 'Ферганская область', nameEn: 'Fergana', centerLat: 40.386, centerLon: 71.786 },
    { id: 'UZ-JI', nameUz: 'Jizzax viloyati', nameRu: 'Джизакская область', nameEn: 'Jizzakh', centerLat: 40.115, centerLon: 67.840 },
    { id: 'UZ-NG', nameUz: 'Namangan viloyati', nameRu: 'Наманганская область', nameEn: 'Namangan', centerLat: 40.998, centerLon: 71.673 },
    { id: 'UZ-NW', nameUz: 'Navoiy viloyati', nameRu: 'Навоийская область', nameEn: 'Navoi', centerLat: 40.103, centerLon: 65.379 },
    { id: 'UZ-QA', nameUz: 'Qashqadaryo viloyati', nameRu: 'Кашкадарьинская область', nameEn: 'Kashkadarya', centerLat: 38.861, centerLon: 65.788 },
    { id: 'UZ-QR', nameUz: 'Qoraqalpog‘iston Respublikasi', nameRu: 'Республика Каракалпакстан', nameEn: 'Karakalpakstan', centerLat: 42.460, centerLon: 59.610 },
    { id: 'UZ-SA', nameUz: 'Samarqand viloyati', nameRu: 'Самаркандская область', nameEn: 'Samarkand', centerLat: 39.660, centerLon: 66.974 },
    { id: 'UZ-SI', nameUz: 'Sirdaryo viloyati', nameRu: 'Сырдарьинская область', nameEn: 'Sirdarya', centerLat: 40.489, centerLon: 68.770 },
    { id: 'UZ-SU', nameUz: 'Surxondaryo viloyati', nameRu: 'Сурхандарьинская область', nameEn: 'Surkhandarya', centerLat: 37.224, centerLon: 67.278 },
    { id: 'UZ-TK', nameUz: 'Toshkent shahri', nameRu: 'Город Ташкент', nameEn: 'Tashkent city', centerLat: 41.299, centerLon: 69.240 },
    { id: 'UZ-TO', nameUz: 'Toshkent viloyati', nameRu: 'Ташкентская область', nameEn: 'Tashkent region', centerLat: 41.450, centerLon: 69.380 },
    { id: 'UZ-XO', nameUz: 'Xorazm viloyati', nameRu: 'Хорезмская область', nameEn: 'Khorezm', centerLat: 41.553, centerLon: 60.630 },
  ] as RegionEntity[],

  categories: [
    { id: 'fire_hydrant', nameUz: 'Yong‘in gidrantlari', nameRu: 'Пожарные гидранты', nameEn: 'Fire hydrants', geometryTypesCsv: 'Point', iconName: 'fire_hydrant_alt', colorHex: '#FFB547' },
    { id: 'water_pipeline', nameUz: 'Ichimlik suvi quvurlari', nameRu: 'Водопроводы', nameEn: 'Drinking-water pipelines', geometryTypesCsv: 'LineString', iconName: 'water', colorHex: '#30CCF2' },
    { id: 'water_network', nameUz: 'Suv taqsimlash tarmoqlari', nameRu: 'Водораспределительные сети', nameEn: 'Water distribution networks', geometryTypesCsv: 'LineString', iconName: 'hub', colorHex: '#40BDF8' },
    { id: 'reservoir', nameUz: 'Suv omborlari', nameRu: 'Водохранилища', nameEn: 'Water reservoirs', geometryTypesCsv: 'Polygon', iconName: 'waves', colorHex: '#38BDF8' },
    { id: 'pumping_station', nameUz: 'Nasos stansiyalari', nameRu: 'Насосные станции', nameEn: 'Pumping stations', geometryTypesCsv: 'Point,Polygon', iconName: 'settings', colorHex: '#56D7C7' },
    { id: 'sewer_pipeline', nameUz: 'Kanalizatsiya quvurlari', nameRu: 'Канализационные трубы', nameEn: 'Sewer pipelines', geometryTypesCsv: 'LineString', iconName: 'route', colorHex: '#A78BFA' },
    { id: 'sewer_manhole', nameUz: 'Kanalizatsiya quduqlari', nameRu: 'Канализационные колодцы', nameEn: 'Sewer manholes', geometryTypesCsv: 'Point', iconName: 'circle', colorHex: '#A78BFA' },
    { id: 'drainage', nameUz: 'Drenaj tizimlari', nameRu: 'Дренажные системы', nameEn: 'Drainage systems', geometryTypesCsv: 'Point,LineString,Polygon', iconName: 'water_drop', colorHex: '#87BAC5' },
    { id: 'gas_pipeline', nameUz: 'Gaz quvurlari', nameRu: 'Газопроводы', nameEn: 'Gas pipelines', geometryTypesCsv: 'LineString', iconName: 'local_fire_department', colorHex: '#F7CA59' },
    { id: 'gas_valve', nameUz: 'Gaz boshqaruv klapanlari', nameRu: 'Газовые клапаны', nameEn: 'Gas control valves', geometryTypesCsv: 'Point', iconName: 'tune', colorHex: '#F7CA59' },
    { id: 'electrical_cable', nameUz: 'Elektr kabellari', nameRu: 'Электрические кабели', nameEn: 'Electrical cables', geometryTypesCsv: 'LineString', iconName: 'bolt', colorHex: '#FDBA74' },
    { id: 'substation', nameUz: 'Elektr podstansiyalari', nameRu: 'Подстанции', nameEn: 'Electrical substations', geometryTypesCsv: 'Point,Polygon', iconName: 'electrical_services', colorHex: '#FDBA74' },
    { id: 'telecommunications', nameUz: 'Telekommunikatsiya infratuzilmasi', nameRu: 'Телекоммуникации', nameEn: 'Telecommunications', geometryTypesCsv: 'Point,LineString,Polygon', iconName: 'cell_tower', colorHex: '#C4B5FD' },
    { id: 'heating_network', nameUz: 'Issiqlik tarmoqlari', nameRu: 'Тепловые сети', nameEn: 'Heating networks', geometryTypesCsv: 'LineString', iconName: 'thermostat', colorHex: '#FB7185' },
    { id: 'emergency_water_source', nameUz: 'Favqulodda suv manbalari', nameRu: 'Аварийные источники воды', nameEn: 'Emergency water sources', geometryTypesCsv: 'Point,Polygon', iconName: 'water_drop', colorHex: '#34D399' },
    { id: 'other', nameUz: 'Boshqa ruxsatli infratuzilma', nameRu: 'Прочая инфраструктура', nameEn: 'Other authorized infrastructure', geometryTypesCsv: 'Point,LineString,Polygon', iconName: 'location_on', colorHex: '#94A3B8' },
  ] as CategoryEntity[],

  demoAccounts: [
    { id: 'acc-citizen-1', phone: '+998900000001', fullName: 'Demo fuqaro', role: 'citizen', employeeStatus: 'none', organizationId: 'org-demo', regionId: 'UZ-TK', districtId: 'DEMO-UZ-TK', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-emp-1', phone: '+998900000011', fullName: 'Demo xodim A', role: 'verified_employee', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-TK', districtId: 'DEMO-UZ-TK', department: 'Operativ guruh', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-emp-2', phone: '+998900000012', fullName: 'Demo xodim B', role: 'verified_employee', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-SA', districtId: 'DEMO-UZ-SA', department: 'Gidrant nazorati', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-emp-3', phone: '+998900000013', fullName: 'Demo xodim C', role: 'infrastructure_inspector', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-BU', districtId: 'DEMO-UZ-BU', department: 'Texnik tekshiruv', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-reviewer', phone: '+998900000021', fullName: 'Demo ma’lumot tekshiruvchisi', role: 'data_reviewer', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-TK', districtId: 'DEMO-UZ-TK', department: 'Ma’lumotlar nazorati', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-supervisor', phone: '+998900000031', fullName: 'Demo hudud rahbari', role: 'regional_supervisor', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-TK', districtId: 'DEMO-UZ-TK', department: 'Hududiy boshqarma', policyEpoch: 1, isSynthetic: true },
    { id: 'acc-admin', phone: '+998900000099', fullName: 'Demo administrator', role: 'system_administrator', employeeStatus: 'verified', organizationId: 'org-demo', regionId: 'UZ-TK', districtId: 'DEMO-UZ-TK', department: 'Tizim ma’muriyati', policyEpoch: 1, isSynthetic: true },
  ] as UserAccountEntity[],

  demoOrganizations: [
    { id: 'org-demo', label: 'SINTETIK DEMO — mustaqil GIS sinov jamoasi' },
    { id: 'org-water', label: 'SINTETIK DEMO — Suv ta’minoti sinov bo‘limi' },
  ],

  createDemoObjects(): InfrastructureObjectEntity[] {
    const statuses = [
      'working',
      'faulty',
      'under_maintenance',
      'temporarily_unavailable',
      'not_inspected',
      'unknown',
    ];
    return Array.from({ length: 30 }, (_, i) => {
      const region = this.regions[i % this.regions.length];
      const category = this.categories[i % this.categories.length];
      const offset = (Math.floor(i / 14) + 1) * 0.014;
      const lat = region.centerLat + offset;
      const lon = region.centerLon + offset;
      const primaryType = category.geometryTypesCsv.split(',')[0];
      let geometryJson: string;
      if (primaryType === 'LineString') {
        geometryJson = GeoUtils.encodeGeoJson('LineString', [
          { lat, lon },
          { lat: lat + 0.045, lon: lon + 0.075 },
        ]);
      } else if (primaryType === 'Polygon') {
        geometryJson = GeoUtils.encodeGeoJson('Polygon', [
          { lat, lon },
          { lat, lon: lon + 0.06 },
          { lat: lat + 0.05, lon: lon + 0.06 },
          { lat: lat + 0.05, lon },
        ]);
      } else {
        geometryJson = GeoUtils.encodeGeoJson('Point', [{ lat, lon }]);
      }

      const measuredAt = isoUtcDaysAgo(3 + i);
      let passportJson: string;
      if (category.id === 'fire_hydrant') {
        passportJson = JSON.stringify({
          schema_version: 1,
          hydrant_type: 'demo',
          installation_type: 'above_ground',
          connection_diameter_mm: 100,
          nominal_pressure_kpa: 400.0,
          measured_pressure_kpa: 320.0,
          flow_lps: 12.5,
          measurement_date: measuredAt,
          measurement_method: 'synthetic_demo',
          accessibility_status: 'open',
          notes: 'SINTETIK DEMO: haqiqiy infratuzilma emas',
        });
      } else if (['water_pipeline', 'water_network', 'reservoir', 'pumping_station'].includes(category.id)) {
        passportJson = JSON.stringify({
          schema_version: 1,
          diameter_mm: 250,
          material: 'steel_demo',
          length_m: 420,
          pressure_kpa: 380.0,
          capacity_m3: 1200,
          notes: 'SINTETIK DEMO: haqiqiy infratuzilma emas',
        });
      } else if (category.id === 'electrical_cable' || category.id === 'substation') {
        passportJson = JSON.stringify({
          schema_version: 1,
          voltage_kv: 10.0,
          cable_type: 'demo_armored',
          installation_method: 'underground',
          notes: 'SINTETIK DEMO: haqiqiy infratuzilma emas',
        });
      } else if (category.id === 'gas_pipeline' || category.id === 'gas_valve') {
        passportJson = JSON.stringify({
          schema_version: 1,
          diameter_mm: 150,
          material: 'polyethylene_demo',
          classification: 'medium_pressure',
          notes: 'SINTETIK DEMO: haqiqiy infratuzilma emas',
        });
      } else {
        passportJson = JSON.stringify({
          schema_version: 1,
          material: 'demo_composite',
          notes: 'SINTETIK DEMO: haqiqiy infratuzilma emas',
        });
      }

      const isPublic = category.id === 'emergency_water_source' || i % 5 === 0;
      const lifecycle = i === 28 || i === 29 ? 'submitted' : 'published';
      const numCode = String(i + 1).padStart(4, '0');
      const numName = String(i + 1).padStart(2, '0');

      return {
        id: `demo-obj-${i + 1}`,
        code: `DEMO-UZ-${numCode}`,
        name: `SINTETIK DEMO — ${category.nameUz} ${numName}`,
        description: 'Faqat dastur sinovi uchun yaratilgan. Joylashuv haqiqiy infratuzilmani ko‘rsatmaydi.',
        categoryId: category.id,
        regionId: region.id,
        districtId: `DEMO-${region.id}`,
        geometryJson,
        operationalStatus: statuses[i % statuses.length],
        lifecycle,
        sensitivity: 'internal',
        version: 1,
        passportJson,
        accuracyM: 4.5,
        updatedAt: isoUtcDaysAgo(i % 10),
        isSynthetic: true,
        isPublicProjected: isPublic,
      };
    });
  },

  createDemoInspections(): InspectionEntity[] {
    return [
      {
        id: 'insp-demo-1',
        objectId: 'demo-obj-1',
        inspectorName: 'Demo xodim A',
        condition: 'good',
        operationalStatus: 'working',
        notes: 'SINTETIK DEMO: Gidrant bosimi me’yorda (320 kPa), kirish yo‘li ochiq.',
        nextInspectionDate: '2026-12-15',
        createdAt: isoUtcDaysAgo(3),
      },
      {
        id: 'insp-demo-2',
        objectId: 'demo-obj-17',
        inspectorName: 'Demo xodim B',
        condition: 'fair',
        operationalStatus: 'under_maintenance',
        notes: 'SINTETIK DEMO: Klapan muhri reja asosida almashtirilmoqda.',
        nextInspectionDate: '2026-11-30',
        createdAt: isoUtcDaysAgo(1),
      },
    ];
  },

  createDemoReports(): CitizenReportEntity[] {
    return [
      {
        id: 'rep-demo-1',
        userId: 'acc-citizen-1',
        category: 'infrastructure_fault',
        description: 'SINTETIK DEMO — Tashkent hududida sinov gidranti qopqog‘i shikastlangan (shoshilinch emas).',
        regionId: 'UZ-TK',
        geometryJson: GeoUtils.encodeGeoJson('Point', [{ lat: 41.311, lon: 69.279 }]),
        contactPhone: '+998900000001',
        status: 'in_progress',
        resolution: null,
        attachmentCount: 0,
        isSynthetic: true,
        createdAt: isoUtcDaysAgo(4),
        updatedAt: isoUtcDaysAgo(1),
      },
    ];
  },

  createDemoRoutes(): ApprovedRouteEntity[] {
    const nowMs = Date.now();
    const routeGeom1 = GeoUtils.encodeGeoJson('LineString', [
      { lat: 41.2995, lon: 69.2401 },
      { lat: 41.3050, lon: 69.2480 },
      { lat: 41.3105, lon: 69.2540 },
      { lat: 41.3130, lon: 69.2540 },
    ]);
    const steps1 = JSON.stringify([
      { name: 'Amir Temur shoh ko‘chasi', distance_m: 680, duration_s: 75, maneuver: { type: 'depart', modifier: 'straight', location: [69.2401, 41.2995] } },
      { name: 'Navoiy ko‘chasi', distance_m: 740, duration_s: 85, maneuver: { type: 'turn', modifier: 'right', location: [69.2480, 41.3050] } },
      { name: 'DEMO-UZ-0001 manzili', distance_m: 310, duration_s: 40, maneuver: { type: 'arrive', modifier: 'straight', location: [69.2540, 41.3130] } },
    ]);

    const routeGeom2 = GeoUtils.encodeGeoJson('LineString', [
      { lat: 39.6542, lon: 66.9597 },
      { lat: 39.6620, lon: 66.9700 },
      { lat: 39.6740, lon: 66.9880 },
    ]);
    const steps2 = JSON.stringify([
      { name: 'Registon ko‘chasi', distance_m: 1150, duration_s: 130, maneuver: { type: 'depart', modifier: 'straight', location: [66.9597, 39.6542] } },
      { name: 'DEMO-UZ-0009 manzili', distance_m: 920, duration_s: 110, maneuver: { type: 'arrive', modifier: 'left', location: [66.9880, 39.6740] } },
    ]);

    return [
      {
        id: 'route-demo-1',
        destinationObjectId: 'demo-obj-1',
        destinationName: 'DEMO-UZ-0001 · Yong‘in gidranti 01',
        requestedBy: 'acc-emp-1',
        geometryJson: routeGeom1,
        stepsJson: steps1,
        distanceM: 1730.0,
        durationS: 200.0,
        status: 'approved',
        approvedBy: 'Demo hudud rahbari',
        expiresAtEpochMs: nowMs + 8 * 3600_000,
        sourceDate: '2026-11-01',
        version: 1,
        createdAt: isoUtcDaysAgo(0),
      },
      {
        id: 'route-demo-2',
        destinationObjectId: 'demo-obj-9',
        destinationName: 'DEMO-UZ-0009 · Gaz quvuri 09',
        requestedBy: 'acc-emp-2',
        geometryJson: routeGeom2,
        stepsJson: steps2,
        distanceM: 2070.0,
        durationS: 240.0,
        status: 'pending',
        approvedBy: null,
        expiresAtEpochMs: null,
        sourceDate: '2026-11-01',
        version: 1,
        createdAt: isoUtcDaysAgo(0),
      },
    ];
  },

  createDemoNotifications(): NotificationEntity[] {
    return [
      {
        id: 'notif-demo-1',
        userId: null,
        title: 'SINTETIK DEMO — Tizim tayyor',
        body: 'Offline sinov bazasi 14 hudud, 16 kategoriya va 30 demo obyekt bilan yuklandi.',
        kind: 'system',
        readAt: null,
        createdAt: isoUtcDaysAgo(0),
      },
      {
        id: 'notif-demo-2',
        userId: 'acc-emp-1',
        title: 'Marshrut tasdiqlandi',
        body: 'DEMO-UZ-0001 obyektiga xizmat marshruti hudud rahbari tomonidan tasdiqlandi.',
        kind: 'route_approved',
        readAt: null,
        createdAt: isoUtcDaysAgo(0),
      },
    ];
  },
};
