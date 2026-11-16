"""Explicit synthetic evaluation fixtures. Never represents surveyed infrastructure."""
from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from geoalchemy2.shape import from_shape
from shapely.geometry import shape
from sqlalchemy import select

from app.core.config import settings
from app.core.policy import ROLE_PERMISSIONS
from app.db.base import utcnow
from app.models import AuditLog, CategorySchemaVersion, District, HydrantMeasurement, HydrantSpec, InfrastructureCategory, InfrastructureObject, ObjectGeometry, ObjectRevision, Organization, Permission, PublicObject, Region, Role, RoleAssignment, RolePermission, SyncCounter, TechnicalPassport, User, UserProfile

REGIONS = [
    ("UZ-AN", "Andijon viloyati", "Андижанская область", "Andijan", 72.344, 40.782),
    ("UZ-BU", "Buxoro viloyati", "Бухарская область", "Bukhara", 64.421, 39.775),
    ("UZ-FA", "Farg‘ona viloyati", "Ферганская область", "Fergana", 71.786, 40.386),
    ("UZ-JI", "Jizzax viloyati", "Джизакская область", "Jizzakh", 67.840, 40.115),
    ("UZ-NG", "Namangan viloyati", "Наманганская область", "Namangan", 71.673, 40.998),
    ("UZ-NW", "Navoiy viloyati", "Навоийская область", "Navoi", 65.379, 40.103),
    ("UZ-QA", "Qashqadaryo viloyati", "Кашкадарьинская область", "Kashkadarya", 65.788, 38.861),
    ("UZ-QR", "Qoraqalpog‘iston Respublikasi", "Республика Каракалпакстан", "Karakalpakstan", 59.610, 42.460),
    ("UZ-SA", "Samarqand viloyati", "Самаркандская область", "Samarkand", 66.974, 39.660),
    ("UZ-SI", "Sirdaryo viloyati", "Сырдарьинская область", "Sirdarya", 68.770, 40.489),
    ("UZ-SU", "Surxondaryo viloyati", "Сурхандарьинская область", "Surkhandarya", 67.278, 37.224),
    ("UZ-TK", "Toshkent shahri", "Город Ташкент", "Tashkent city", 69.240, 41.299),
    ("UZ-TO", "Toshkent viloyati", "Ташкентская область", "Tashkent region", 69.380, 41.450),
    ("UZ-XO", "Xorazm viloyati", "Хорезмская область", "Khorezm", 60.630, 41.553),
]
CATEGORIES = [
    ("fire_hydrant", "Yong‘in gidrantlari", "Пожарные гидранты", "Fire hydrants", ["Point"], "fire_hydrant_alt", "#FFB547"),
    ("water_pipeline", "Ichimlik suvi quvurlari", "Водопроводы", "Drinking-water pipelines", ["LineString", "MultiLineString"], "water", "#30CCF2"),
    ("water_network", "Suv taqsimlash tarmoqlari", "Водораспределительные сети", "Water distribution networks", ["LineString", "MultiLineString"], "hub", "#40BDF8"),
    ("reservoir", "Suv omborlari", "Водохранилища", "Water reservoirs", ["Point", "Polygon", "MultiPolygon"], "waves", "#38BDF8"),
    ("pumping_station", "Nasos stansiyalari", "Насосные станции", "Pumping stations", ["Point", "Polygon"], "settings", "#56D7C7"),
    ("sewer_pipeline", "Kanalizatsiya quvurlari", "Канализационные трубы", "Sewer pipelines", ["LineString", "MultiLineString"], "route", "#A78BFA"),
    ("sewer_manhole", "Kanalizatsiya quduqlari", "Канализационные колодцы", "Sewer manholes", ["Point"], "circle", "#A78BFA"),
    ("drainage", "Drenaj tizimlari", "Дренажные системы", "Drainage systems", ["Point", "LineString", "MultiLineString", "Polygon"], "water_drop", "#87BAC5"),
    ("gas_pipeline", "Gaz quvurlari", "Газопроводы", "Gas pipelines", ["LineString", "MultiLineString"], "local_fire_department", "#F7CA59"),
    ("gas_valve", "Gaz boshqaruv klapanlari", "Газовые клапаны", "Gas control valves", ["Point"], "tune", "#F7CA59"),
    ("electrical_cable", "Elektr kabellari", "Электрические кабели", "Electrical cables", ["LineString", "MultiLineString"], "bolt", "#FDBA74"),
    ("substation", "Elektr podstansiyalari", "Подстанции", "Electrical substations", ["Point", "Polygon"], "electrical_services", "#FDBA74"),
    ("telecommunications", "Telekommunikatsiya infratuzilmasi", "Телекоммуникации", "Telecommunications", ["Point", "LineString", "MultiLineString", "Polygon"], "cell_tower", "#C4B5FD"),
    ("heating_network", "Issiqlik tarmoqlari", "Тепловые сети", "Heating networks", ["LineString", "MultiLineString"], "thermostat", "#FB7185"),
    ("emergency_water_source", "Favqulodda suv manbalari", "Аварийные источники воды", "Emergency water sources", ["Point", "Polygon"], "water_drop", "#34D399"),
    ("other", "Boshqa ruxsatli infratuzilma", "Прочая инфраструктура", "Other authorized infrastructure", ["Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"], "location_on", "#94A3B8"),
]


def stable_id(value: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"fvv-independent-synthetic:{value}"))


def schema_for(category_id):
    common = [
        {"key": "manufacturer", "type": "string", "label_uz": "Ishlab chiqaruvchi", "nullable": True},
        {"key": "material", "type": "string", "label_uz": "Material", "nullable": True},
        {"key": "installation_date", "type": "date", "label_uz": "O‘rnatilgan sana", "nullable": True},
        {"key": "last_inspection_date", "type": "date", "label_uz": "Oxirgi tekshiruv", "nullable": True},
        {"key": "next_inspection_date", "type": "date", "label_uz": "Keyingi tekshiruv", "nullable": True},
        {"key": "notes", "type": "string", "label_uz": "Izoh", "nullable": True},
    ]
    category_fields = {
        "fire_hydrant": [("hydrant_type", "string", None), ("installation_type", "string", None), ("connection_diameter_mm", "number", "mm"),
                         ("nominal_pressure_kpa", "number", "kPa"), ("measured_pressure_kpa", "number", "kPa"),
                         ("flow_lps", "number", "L/s"), ("measurement_date", "datetime", None),
                         ("measurement_method", "string", None), ("accessibility_status", "string", None)],
        "water_pipeline": [("diameter_mm", "number", "mm"), ("length_m", "number", "m"), ("depth_m", "number", "m"), ("pressure_kpa", "number", "kPa")],
        "sewer_pipeline": [("diameter_mm", "number", "mm"), ("depth_m", "number", "m"), ("flow_type", "string", None), ("reported_blockages", "integer", None)],
        "gas_pipeline": [("diameter_mm", "number", "mm"), ("classification", "string", None), ("pressure_kpa", "number", "kPa")],
        "electrical_cable": [("voltage_kv", "number", "kV"), ("cable_type", "string", None), ("installation_method", "string", None)],
    }
    family = {"water_network": "water_pipeline", "sewer_manhole": "sewer_pipeline", "gas_valve": "gas_pipeline", "substation": "electrical_cable"}.get(category_id, category_id)
    fields = common + [{"key": key, "type": type_, "unit": unit, "label_uz": key.replace("_", " ").capitalize(),
                        "nullable": True, **({"minimum": 0} if type_ in {"number", "integer"} else {})}
                       for key, type_, unit in category_fields.get(family, [])]
    return {"version": 1, "fields": fields}


def seed_catalog(db):
    for code, uz, ru, en, lon, lat in REGIONS:
        if not db.get(Region, code):
            db.add(Region(id=code, name_uz=uz, name_ru=ru, name_en=en))
    for role, permissions in ROLE_PERMISSIONS.items():
        if not db.get(Role, role):
            db.add(Role(id=role, name=role.replace("_", " ").title()))
    all_permissions = set().union(*ROLE_PERMISSIONS.values())
    for permission in all_permissions:
        if not db.get(Permission, permission):
            db.add(Permission(id=permission, description=permission))
    db.flush()
    for role, permissions in ROLE_PERMISSIONS.items():
        for permission in permissions:
            if not db.get(RolePermission, (role, permission)):
                db.add(RolePermission(role_id=role, permission_id=permission))
    for code, uz, ru, en, types, icon, color in CATEGORIES:
        if not db.get(InfrastructureCategory, code):
            definition = schema_for(code)
            db.add(InfrastructureCategory(id=code, name_uz=uz, name_ru=ru, name_en=en,
                                           geometry_types=types, icon=icon, color=color, passport_schema=definition))
            db.flush()
            db.add(CategorySchemaVersion(category_id=code, version=1, definition=definition))
    if not db.get(SyncCounter, 1):
        db.add(SyncCounter(id=1, value=0))
    db.flush()


def seed_demo(db):
    if not settings.is_development:
        raise RuntimeError("Synthetic demo seeding is limited to development/test")
    seed_catalog(db)
    org_id = stable_id("organization")
    if not db.get(Organization, org_id):
        db.add(Organization(id=org_id, name="SINTETIK DEMO — mustaqil GIS sinov jamoasi", is_synthetic=True))
    db.flush()
    for code, uz, ru, en, lon, lat in REGIONS:
        district_id = f"DEMO-{code}"
        if not db.get(District, district_id):
            db.add(District(id=district_id, region_id=code, name_uz="SINTETIK DEMO tumani", is_synthetic=True))
    db.flush()
    accounts = [("+998900000001", "Demo fuqaro", "citizen"),
                ("+998900000011", "Demo xodim A", "verified_employee"),
                ("+998900000012", "Demo xodim B", "verified_employee"),
                ("+998900000013", "Demo xodim C", "verified_employee"),
                ("+998900000021", "Demo ma’lumot tekshiruvchisi", "data_reviewer"),
                ("+998900000031", "Demo hudud rahbari", "regional_supervisor"),
                ("+998900000099", "Demo administrator", "system_administrator")]
    users = []
    for phone, name, role in accounts:
        uid = stable_id(phone)
        user = db.get(User, uid)
        if not user:
            user = User(id=uid, phone=phone, full_name=name, role=role, employee_status="none" if role == "citizen" else "verified",
                         organization_id=org_id, is_synthetic=True, phone_verified_at=utcnow())
            db.add(user)
            db.flush()
            db.add(UserProfile(user_id=uid))
            if role != "citizen":
                db.add(RoleAssignment(user_id=uid, role_id=role, organization_id=org_id, max_sensitivity="confidential"))
        users.append(user)
    db.flush()
    statuses = ["working", "faulty", "under_maintenance", "temporarily_unavailable", "not_inspected", "unknown"]
    for i in range(30):
        oid = stable_id(f"object-{i}")
        if db.get(InfrastructureObject, oid):
            continue
        region = REGIONS[i % 14]
        category = CATEGORIES[i % 16]
        code, _, _, _, lon, lat = region
        offset = (i // 14 + 1) * 0.012
        point = [round(lon + offset, 6), round(lat + offset, 6)]
        gtype = category[4][0]
        if gtype == "LineString":
            geometry = {"type": "LineString", "coordinates": [point, [point[0] + 0.008, point[1] + 0.004]]}
        elif gtype == "Polygon":
            geometry = {"type": "Polygon", "coordinates": [[point, [point[0] + .003, point[1]], [point[0] + .003, point[1] + .003], [point[0], point[1] + .003], point]]}
        else:
            geometry = {"type": "Point", "coordinates": point}
        measured = utcnow() - timedelta(days=3 + i)
        passport = {"manufacturer": None, "material": None, "notes": "SINTETIK DEMO: haqiqiy infratuzilma emas"}
        if category[0] == "fire_hydrant":
            passport.update({"hydrant_type": "demo", "installation_type": "above_ground", "connection_diameter_mm": 100,
                             "measured_pressure_kpa": 320.0, "flow_lps": 12.5,
                             "measurement_date": measured.isoformat(), "measurement_method": "synthetic_demo"})
        creator = users[1 + i % 3]
        obj = InfrastructureObject(id=oid, code=f"DEMO-UZ-{i + 1:04}", name=f"SINTETIK DEMO — {category[1]} {i + 1:02}",
            description="Faqat dastur sinovi uchun yaratilgan. Joylashuv haqiqiy infratuzilmani ko‘rsatmaydi.",
            category_id=category[0], region_id=code, district_id=f"DEMO-{code}", organization_id=org_id,
            responsible_employee_id=creator.id, sensitivity="internal", operational_status=statuses[i % 6],
            lifecycle="published", verification_status="synthetic_demo", version=1, geometry=geometry, passport=passport,
            accuracy_m=None, data_source="synthetic_demo", is_synthetic=True, created_by=creator.id, updated_by=creator.id)
        db.add(obj)
        db.flush()
        db.add(ObjectGeometry(object_id=oid, geom=from_shape(shape(geometry), srid=4326)))
        tp = TechnicalPassport(object_id=oid, notes=passport["notes"])
        db.add(tp)
        db.flush()
        if category[0] == "fire_hydrant":
            db.add(HydrantSpec(passport_id=tp.id, hydrant_type="demo", installation_type="above_ground", connection_diameter_mm=100,
                               measured_pressure_kpa=320.0, flow_lps=12.5, measurement_date=measured, measurement_method="synthetic_demo"))
            db.add(HydrantMeasurement(object_id=oid, pressure_kpa=320, flow_lps=12.5, measured_at=measured,
                                      method="synthetic_demo", measured_by=creator.id))
        data = {"id": oid, "code": obj.code, "name": obj.name, "description": obj.description, "category_id": obj.category_id,
                "region_id": code, "district_id": obj.district_id, "organization_id": org_id, "sensitivity": obj.sensitivity,
                "operational_status": obj.operational_status, "lifecycle": "published", "version": 1,
                "geometry": geometry, "passport": passport, "accuracy_m": None, "data_source": "synthetic_demo",
                "is_synthetic": True, "created_by": creator.id, "updated_by": creator.id,
                "created_at": obj.created_at.isoformat(), "updated_at": obj.updated_at.isoformat()}
        revision = ObjectRevision(object_id=oid, version=1, data=data, state="published", created_by=creator.id)
        db.add(revision)
        db.flush()
        obj.published_revision_id = revision.id
        if category[0] == "emergency_water_source":
            db.add(PublicObject(object_id=oid, name=obj.name, category_id=category[0], region_id=code,
                                district_id=obj.district_id, geometry=geometry, operational_status="unknown",
                                is_synthetic=True, published_by=users[4].id))
    db.add(AuditLog(actor_id=users[-1].id, action="demo.seeded", target_type="system",
                    details={"source": "synthetic_demo", "record_limit": 30}))
    db.commit()
    return {"objects": 30, "regions": 14, "categories": 16, "accounts": [{"phone": p, "role": r} for p, _, r in accounts]}
