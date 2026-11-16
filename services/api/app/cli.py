import argparse
import json

from sqlalchemy import select

from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import AuditLog, RoleAssignment, User, UserProfile
from app.schemas.auth import PhoneRequest
from app.seed import seed_catalog, seed_demo


def main():
    parser = argparse.ArgumentParser(description="FVV GIS operator commands")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("seed-demo", help="Development-only synthetic fixtures")
    sub.add_parser("seed-catalog", help="Administrative regions, categories, initial roles")
    admin = sub.add_parser("create-admin", help="Bootstrap administrator; MFA required at first login")
    admin.add_argument("--phone", required=True)
    admin.add_argument("--name", required=True)
    admin.add_argument("--synthetic", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.command == "seed-demo":
            result = seed_demo(db)
        elif args.command == "seed-catalog":
            seed_catalog(db)
            db.commit()
            result = {"status": "catalog_seeded"}
        else:
            phone = PhoneRequest(phone=args.phone).phone
            if db.scalar(select(User.id).where(User.phone == phone)):
                parser.error("Phone already exists; modify its privileges through the audited administration workflow")
            seed_catalog(db)
            user = User(phone=phone, full_name=args.name, role="super_administrator", employee_status="verified",
                        is_synthetic=args.synthetic, phone_verified_at=utcnow())
            db.add(user)
            db.flush()
            db.add(UserProfile(user_id=user.id))
            db.add(RoleAssignment(user_id=user.id, role_id="super_administrator", max_sensitivity="confidential"))
            db.add(AuditLog(actor_id=user.id, action="admin.bootstrapped", target_type="user", target_id=user.id))
            db.commit()
            result = {"id": user.id, "status": "created", "mfa_required": True}
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
