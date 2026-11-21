import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FilePlus2,
  ImagePlus,
  LocateFixed,
  Lock,
  Save,
  Trash2,
} from 'lucide-react';
import { GeoUtils, allGeometryPoints, localizedCategoryName, localizedRegionName } from '../core/geoUtils';
import { requestBrowserGpsFix } from '../core/locationHelper';
import { L10n } from '../core/localization';
import { useApp } from '../context/AppContext';
import { AppRoute, GeoPoint, MapViewport } from '../types/gis';
import { DataRowView, SectionCard } from '../components/CommonComponents';
import { UzbekistanGisCanvas } from '../components/UzbekistanGisCanvas';

interface TechnicalFieldDef {
  key: string;
  labelUz: string;
  labelRu: string;
  labelEn: string;
  placeholder?: string;
}

const TECHNICAL_FIELDS_BY_CATEGORY: Record<string, TechnicalFieldDef[]> = {
  fire_hydrant: [
    { key: 'measured_pressure_kpa', labelUz: 'O‘lchangan bosim (kPa)', labelRu: 'Давление (кПа)', labelEn: 'Measured pressure (kPa)', placeholder: '420' },
    { key: 'flow_lps', labelUz: 'Suv sarfi (L/s)', labelRu: 'Расход воды (л/с)', labelEn: 'Water flow (L/s)', placeholder: '28' },
    { key: 'measurement_date', labelUz: 'O‘lchov sanasi (YYYY-MM-DD)', labelRu: 'Дата измерения', labelEn: 'Measurement date', placeholder: '2026-10-15' },
    { key: 'pipe_diameter_mm', labelUz: 'Quvur diametri (mm)', labelRu: 'Диаметр трубы (мм)', labelEn: 'Pipe diameter (mm)', placeholder: '150' },
  ],
  water_reservoir: [
    { key: 'capacity_m3', labelUz: 'Sig‘imi (m³)', labelRu: 'Объём (м³)', labelEn: 'Capacity (m³)', placeholder: '1500' },
    { key: 'measured_pressure_kpa', labelUz: 'Bosim (kPa)', labelRu: 'Давление (кПа)', labelEn: 'Pressure (kPa)', placeholder: '310' },
    { key: 'measurement_date', labelUz: 'O‘lchov sanasi', labelRu: 'Дата измерения', labelEn: 'Measurement date', placeholder: '2026-10-15' },
  ],
  pumping_station: [
    { key: 'pump_count', labelUz: 'Nasoslar soni', labelRu: 'Число насосов', labelEn: 'Pump count', placeholder: '3' },
    { key: 'flow_lps', labelUz: 'Umumiy sarf (L/s)', labelRu: 'Общий расход (л/с)', labelEn: 'Total flow (L/s)', placeholder: '95' },
    { key: 'measured_pressure_kpa', labelUz: 'Chiqish bosimi (kPa)', labelRu: 'Выходное давление (кПа)', labelEn: 'Outlet pressure (kPa)', placeholder: '480' },
    { key: 'measurement_date', labelUz: 'O‘lchov sanasi', labelRu: 'Дата измерения', labelEn: 'Measurement date', placeholder: '2026-10-15' },
  ],
  gas_pipeline: [
    { key: 'measured_pressure_kpa', labelUz: 'Quvur bosimi (kPa)', labelRu: 'Давление газа (кПа)', labelEn: 'Line pressure (kPa)', placeholder: '300' },
    { key: 'pipe_diameter_mm', labelUz: 'Quvur diametri (mm)', labelRu: 'Диаметр (мм)', labelEn: 'Diameter (mm)', placeholder: '219' },
    { key: 'measurement_date', labelUz: 'Tekshiruv sanasi', labelRu: 'Дата замера', labelEn: 'Measurement date', placeholder: '2026-10-15' },
  ],
  substation: [
    { key: 'voltage_kv', labelUz: 'Kuchlanish (kV)', labelRu: 'Напряжение (кВ)', labelEn: 'Voltage (kV)', placeholder: '35/10' },
    { key: 'transformer_mva', labelUz: 'Transformator quvvati (MVA)', labelRu: 'Мощность (МВА)', labelEn: 'Capacity (MVA)', placeholder: '16' },
  ],
};

const DEFAULT_TECHNICAL_FIELDS: TechnicalFieldDef[] = [
  { key: 'owner_org', labelUz: 'Balansda saqlovchi', labelRu: 'Балансодержатель', labelEn: 'Operator / Owner' },
  { key: 'measured_pressure_kpa', labelUz: 'Bosim (kPa)', labelRu: 'Давление (кПа)', labelEn: 'Pressure (kPa)' },
  { key: 'measurement_date', labelUz: 'O‘lchov sanasi', labelRu: 'Дата измерения', labelEn: 'Measurement date' },
];

export const ObjectFormScreen: React.FC<{
  objectId: string | null;
  onNavigate: (route: AppRoute) => void;
  onDone: (savedId: string) => void;
}> = ({ objectId, onNavigate, onDone }) => {
  const {
    state,
    regions,
    categories,
    getObjectById,
    getDraft,
    saveDraft,
    saveInfrastructureObject,
    showMessage,
  } = useApp();
  const locale = state.locale;
  const draftId = objectId ?? 'new-object';

  const existingObj = useMemo(() => (objectId ? getObjectById(objectId) : null), [objectId, getObjectById]);

  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? 'fire_hydrant');
  const [regionId, setRegionId] = useState<string>(regions[0]?.id ?? 'UZ-TK');
  const [geomType, setGeomType] = useState<'Point' | 'LineString' | 'Polygon'>('Point');
  const [vertices, setVertices] = useState<GeoPoint[]>([{ lat: 41.3111, lon: 69.2797 }]);
  const [latInput, setLatInput] = useState('41.31110');
  const [lonInput, setLonInput] = useState('69.27970');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('working');
  const [accuracyM, setAccuracyM] = useState<number | null>(8.0);
  const [techFields, setTechFields] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<{ filename: string; uriString: string }[]>([]);
  const [pickerViewport, setPickerViewport] = useState<MapViewport>({
    centerLat: 41.31,
    centerLon: 69.27,
    zoom: 6.5,
  });

  // Load existing object or saved draft on mount / objectId change
  useEffect(() => {
    const rawDraft = getDraft(draftId);
    if (rawDraft && !existingObj) {
      try {
        const d = JSON.parse(rawDraft) as Record<string, unknown>;
        if (typeof d.categoryId === 'string') setCategoryId(d.categoryId);
        if (typeof d.regionId === 'string') setRegionId(d.regionId);
        if (d.geomType === 'Point' || d.geomType === 'LineString' || d.geomType === 'Polygon') {
          setGeomType(d.geomType);
        }
        if (Array.isArray(d.vertices) && d.vertices.length > 0) {
          setVertices(d.vertices as GeoPoint[]);
          const first = d.vertices[0] as GeoPoint;
          setLatInput(first.lat.toFixed(5));
          setLonInput(first.lon.toFixed(5));
        }
        if (typeof d.code === 'string') setCode(d.code);
        if (typeof d.name === 'string') setName(d.name);
        if (typeof d.description === 'string') setDescription(d.description);
        if (typeof d.operationalStatus === 'string') setOperationalStatus(d.operationalStatus);
        if (d.techFields && typeof d.techFields === 'object') {
          setTechFields(d.techFields as Record<string, string>);
        }
        return;
      } catch {
        // ignore bad draft
      }
    }

    if (existingObj) {
      setCategoryId(existingObj.categoryId);
      setRegionId(existingObj.regionId);
      setCode(existingObj.code);
      setName(existingObj.name);
      setDescription(existingObj.description);
      setOperationalStatus(existingObj.operationalStatus);
      setAccuracyM(existingObj.accuracyM);
      const parsed = GeoUtils.parseGeoJson(existingObj.geometryJson);
      if (parsed) {
        setGeomType(parsed.type);
        const pts = allGeometryPoints(parsed);
        if (pts.length > 0) {
          setVertices(pts);
          setLatInput(pts[0].lat.toFixed(5));
          setLonInput(pts[0].lon.toFixed(5));
          setPickerViewport({ centerLat: pts[0].lat, centerLon: pts[0].lon, zoom: 7.5 });
        }
      }
      try {
        const parsedPass = JSON.parse(existingObj.passportJson) as Record<string, unknown>;
        const nextTech: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsedPass)) {
          if (k !== 'schema_version' && v !== null && v !== undefined) {
            nextTech[k] = String(v);
          }
        }
        setTechFields(nextTech);
      } catch {
        setTechFields({});
      }
    }
  }, [existingObj, draftId, getDraft]);

  const activeTechFieldDefs = TECHNICAL_FIELDS_BY_CATEGORY[categoryId] ?? DEFAULT_TECHNICAL_FIELDS;

  const previewMarker = useMemo(() => {
    if (geomType === 'Point') {
      const p = vertices[0] ?? { lat: 41.31, lon: 69.27 };
      return GeoUtils.encodeGeoJson('Point', [p]);
    }
    if (geomType === 'LineString' && vertices.length >= 2) {
      return GeoUtils.encodeGeoJson('LineString', vertices);
    }
    if (geomType === 'Polygon' && vertices.length >= 3) {
      return GeoUtils.encodeGeoJson('Polygon', vertices);
    }
    return GeoUtils.encodeGeoJson('Point', [vertices[0] ?? { lat: 41.31, lon: 69.27 }]);
  }, [geomType, vertices]);

  if (!state.isEmployee) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <Lock className="w-12 h-12 text-[var(--primary)]" />
        <p className="text-base font-semibold text-[var(--ink)] max-w-md">
          {L10n.text(locale, 'employeeRequiredForAdd')}
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'auth' })}
          className="px-5 py-3 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold cursor-pointer"
        >
          {L10n.text(locale, 'login')}
        </button>
      </div>
    );
  }

  const handleSaveDraftClick = () => {
    saveDraft(
      draftId,
      JSON.stringify({
        categoryId,
        regionId,
        geomType,
        vertices,
        code,
        name,
        description,
        operationalStatus,
        techFields,
      })
    );
    showMessage(L10n.text(locale, 'saveDraft'));
  };

  const handleCaptureGps = async () => {
    const fix = await requestBrowserGpsFix();
    setLatInput(fix.point.lat.toFixed(5));
    setLonInput(fix.point.lon.toFixed(5));
    setAccuracyM(fix.accuracyMeters);
    if (geomType === 'Point') {
      setVertices([fix.point]);
    } else {
      setVertices((prev) => [...prev, fix.point]);
    }
    setPickerViewport({ centerLat: fix.point.lat, centerLon: fix.point.lon, zoom: 9 });
  };

  const handleAddManualPoint = () => {
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const pt = { lat, lon };
    if (geomType === 'Point') {
      setVertices([pt]);
    } else {
      setVertices((prev) => [...prev, pt]);
    }
    setPickerViewport((vp) => ({ ...vp, centerLat: lat, centerLon: lon }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachments((prev) => [...prev, { filename: file.name, uriString: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleFinalSave = () => {
    const finalCode = code.trim() || `FVV-${Date.now().toString().slice(-5)}`;
    const finalName = name.trim() || 'Infratuzilma obyekti';
    const passportObj: Record<string, unknown> = { schema_version: 1 };
    for (const [k, v] of Object.entries(techFields)) {
      if (v.trim().length > 0) {
        const num = Number(v);
        passportObj[k] = Number.isFinite(num) && !k.includes('date') && v.trim() !== '' ? num : v.trim();
      }
    }
    const res = saveInfrastructureObject({
      existingId: objectId,
      code: finalCode,
      name: finalName,
      description: description.trim(),
      categoryId,
      regionId,
      geometryJson: previewMarker,
      operationalStatus,
      passportJson: JSON.stringify(passportObj),
      accuracyM,
      attachments,
    });
    showMessage(
      res.queued
        ? L10n.text(locale, 'queued_offline')
        : `${L10n.text(locale, 'save')}: ${finalCode}`
    );
    onDone(res.resultId);
  };

  const canProceed =
    step !== 2 || (code.trim().length > 0 && name.trim().length > 0);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
            {existingObj ? L10n.text(locale, 'edit') : L10n.text(locale, 'addRegistryItem')}
          </h2>
          <p className="text-xs text-[var(--ink-muted)] tabular-nums">
            {L10n.pick(locale, 'Bosqich', 'Шаг', 'Step')} {step + 1} / 6
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveDraftClick}
          data-testid="object_form_save_draft"
          className="px-3.5 py-2 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] inline-flex items-center gap-1.5 hover:bg-[var(--surface-elevated)] cursor-pointer"
        >
          <Save className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>{L10n.text(locale, 'saveDraft')}</span>
        </button>
      </div>

      {/* Step progress indicator */}
      <div className="grid grid-cols-6 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            aria-label={`Step ${i + 1}`}
            className={`h-2 rounded-full transition-colors cursor-pointer ${
              i <= step ? 'bg-[var(--primary)]' : 'bg-[var(--outline)]/45'
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <SectionCard title={`${L10n.text(locale, 'category')} & ${L10n.text(locale, 'region')}`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1.5">
                {L10n.text(locale, 'category')}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                data-testid="form_category_select"
                className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {localizedCategoryName(cat, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1.5">
                {L10n.text(locale, 'region')}
              </label>
              <select
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  const reg = regions.find((r) => r.id === e.target.value);
                  if (reg) {
                    setPickerViewport({ centerLat: reg.centerLat, centerLon: reg.centerLon, zoom: 5.5 });
                  }
                }}
                data-testid="form_region_select"
                className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {localizedRegionName(r, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>
      )}

      {step === 1 && (
        <SectionCard title={L10n.text(locale, 'geometry')}>
          <div className="space-y-3.5">
            <div className="flex flex-wrap gap-2">
              {(['Point', 'LineString', 'Polygon'] as const).map((t) => {
                const labelKey = t === 'Point' ? 'point' : t === 'LineString' ? 'line' : 'polygon';
                const active = geomType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setGeomType(t);
                      if (t === 'Point' && vertices.length > 1) {
                        setVertices([vertices[0]]);
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface-elevated)]/60 text-[var(--ink)] border-[var(--outline)]/50'
                    }`}
                  >
                    {L10n.text(locale, labelKey)}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleCaptureGps}
                className="ml-auto px-3.5 py-2 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>{L10n.text(locale, 'gps')}</span>
              </button>
            </div>

            <div className="h-64 rounded-2xl overflow-hidden border border-[var(--outline)]/60 relative">
              <UzbekistanGisCanvas
                markers={[]}
                regions={regions}
                localeCode={locale}
                darkTheme={state.darkTheme}
                viewport={pickerViewport}
                onViewportChange={setPickerViewport}
                measurePoints={geomType !== 'Point' ? vertices : []}
                routePoints={[]}
                routeIsWarning={false}
                userLocation={null}
                emergencyPin={vertices[0] ?? null}
                downloadPreviewBounds={null}
                savedAreaBounds={[]}
                selectedObjectId={null}
                onMarkerTap={() => {}}
                onClusterTap={() => {}}
                onMapTap={(pt) => {
                  setLatInput(pt.lat.toFixed(5));
                  setLonInput(pt.lon.toFixed(5));
                  if (geomType === 'Point') {
                    setVertices([pt]);
                  } else {
                    setVertices((prev) => [...prev, pt]);
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-[11px] text-[var(--ink-muted)] mb-1">
                  {L10n.text(locale, 'latitude')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm font-mono text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--ink-muted)] mb-1">
                  {L10n.text(locale, 'longitude')}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm font-mono text-[var(--ink)]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddManualPoint}
                className="h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--outline)] text-xs font-bold text-[var(--ink)] cursor-pointer"
              >
                {geomType === 'Point'
                  ? L10n.pick(locale, 'Nuqtani qo‘llash', 'Применить точку', 'Set point')
                  : L10n.pick(locale, 'Nuqta qo‘shish', 'Добавить вершину', 'Add vertex')}
              </button>
            </div>

            {vertices.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {vertices.map((v, idx) => (
                  <div
                    key={`${v.lat}-${v.lon}-${idx}`}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)]/55 text-xs font-mono text-[var(--ink)]"
                  >
                    <span>
                      #{idx + 1}: {v.lat.toFixed(5)}°, {v.lon.toFixed(5)}°
                    </span>
                    {vertices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setVertices((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--error)] p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {step === 2 && (
        <SectionCard title={L10n.pick(locale, 'Asosiy ma’lumotlar', 'Основные данные', 'Basic details')}>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                {L10n.text(locale, 'codeLabel')} *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FH-TK-099"
                data-testid="form_code_input"
                className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm font-mono text-[var(--ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                {L10n.text(locale, 'objectName')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="form_name_input"
                className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                {L10n.text(locale, 'description')}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="form_desc_input"
                className="w-full rounded-xl border border-[var(--outline)] bg-[var(--bg)] p-3 text-sm text-[var(--ink)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1.5">
                {L10n.text(locale, 'status')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['working', 'faulty', 'under_maintenance', 'temporarily_unavailable', 'unknown'].map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOperationalStatus(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        operationalStatus === st
                          ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                          : 'bg-[var(--surface-elevated)]/55 text-[var(--ink)] border-[var(--outline)]/50'
                      }`}
                    >
                      {L10n.text(locale, st)}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {step === 3 && (
        <SectionCard title={L10n.text(locale, 'technicalPassport')}>
          <div className="space-y-3">
            {activeTechFieldDefs.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
                  {L10n.pick(locale, field.labelUz, field.labelRu, field.labelEn)}
                </label>
                <input
                  type="text"
                  value={techFields[field.key] ?? ''}
                  placeholder={field.placeholder ?? ''}
                  onChange={(e) =>
                    setTechFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3.5 text-sm text-[var(--ink)]"
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {step === 4 && (
        <SectionCard title={L10n.text(locale, 'attachments')}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              <label className="px-4 py-2.5 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                <span>{L10n.text(locale, 'addPhoto')}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <label className="px-4 py-2.5 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] inline-flex items-center gap-2 cursor-pointer">
                <FilePlus2 className="w-4 h-4" />
                <span>{L10n.text(locale, 'addFile')}</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-[var(--ink-muted)]">{L10n.text(locale, 'empty')}</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.filename}-${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-elevated)]/55 border border-[var(--outline)]/40"
                  >
                    <span className="text-xs font-semibold text-[var(--ink)] truncate">
                      {att.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[var(--error)] p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {step === 5 && (
        <SectionCard title={L10n.text(locale, 'review')}>
          <div className="divide-y divide-[var(--outline)]/35">
            <DataRowView label={L10n.text(locale, 'codeLabel')} value={code || '—'} mono />
            <DataRowView label={L10n.text(locale, 'objectName')} value={name || '—'} />
            <DataRowView
              label={L10n.text(locale, 'category')}
              value={
                categories.find((c) => c.id === categoryId)
                  ? localizedCategoryName(categories.find((c) => c.id === categoryId)!, locale)
                  : categoryId
              }
            />
            <DataRowView
              label={L10n.text(locale, 'region')}
              value={
                regions.find((r) => r.id === regionId)
                  ? localizedRegionName(regions.find((r) => r.id === regionId)!, locale)
                  : regionId
              }
            />
            <DataRowView label={L10n.text(locale, 'status')} value={L10n.text(locale, operationalStatus)} />
            <DataRowView
              label={L10n.text(locale, 'geometry')}
              value={`${geomType} (${vertices.length})`}
              mono
            />
            <DataRowView label={L10n.text(locale, 'attachments')} value={attachments.length} mono />
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : onNavigate({ name: 'registry' }))}
          className="h-12 px-5 rounded-xl border border-[var(--outline)] text-sm font-semibold text-[var(--ink)] inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{step > 0 ? L10n.pick(locale, 'Oldingi', 'Назад', 'Back') : L10n.text(locale, 'cancel')}</span>
        </button>

        {step < 5 ? (
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => setStep(step + 1)}
            data-testid="form_next_step_button"
            className="h-12 px-6 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold inline-flex items-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-45"
          >
            <span>{L10n.text(locale, 'continue')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinalSave}
            data-testid="form_submit_save_button"
            className="h-12 px-6 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-bold inline-flex items-center gap-2 hover:opacity-95 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{L10n.text(locale, 'save')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
