"""RQ jobs; provider credentials and message bodies are never written to logs."""

import argparse
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from redis import Redis
from rq import Queue, Retry, Worker
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.integrations import send_push_message
from app.models import CitizenReport, DeviceRegistration, Notification, ObjectAttachment, OTPChallenge, RetentionDeletion, UserProfile
from app.services.storage import delete_private, scan_attachment


def enqueue_notification(notification_id: str) -> str:
    if not settings.firebase_credentials_path:
        # In-app delivery remains authoritative when push is not configured.
        return "in_app"
    job = Queue(connection=Redis.from_url(settings.redis_url)).enqueue(
        deliver_notification,
        notification_id,
        job_id=f"push-{notification_id}",
        retry=Retry(max=3, interval=[30, 120, 600]),
        result_ttl=86400,
    )
    return job.id


def deliver_notification(notification_id: str) -> int:
    delivered = 0
    with SessionLocal() as db:
        notice = db.get(Notification, notification_id)
        if notice is None:
            return 0
        public = notice.is_public and notice.reviewed_by is not None
        if not public and notice.user_id is None:
            raise ValueError("Unreviewed notices cannot be broadcast")
        query = select(DeviceRegistration).where(DeviceRegistration.revoked_at.is_(None))
        if not public:
            query = query.where(DeviceRegistration.user_id == notice.user_id)
        for device in db.scalars(query):
            profile = db.get(UserProfile, device.user_id)
            if profile and profile.notification_preferences.get("push") is False:
                continue
            valid = send_push_message(
                device.push_token,
                notice.id,
                public_title=notice.title if public else None,
                public_body=notice.body if public else None,
            )
            if valid:
                delivered += 1
            else:
                device.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return delivered


def expire_closed_reports() -> int:
    """Delete expired closed cases, honoring legal holds and an approved operator policy."""
    if not settings.live_policy_ready:
        raise RuntimeError("An approved operator retention policy is required")
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.report_retention_days)
    removed = 0
    with SessionLocal() as db:
        reports = db.scalars(
            select(CitizenReport).where(
                CitizenReport.closed_at.is_not(None),
                CitizenReport.closed_at < cutoff,
                CitizenReport.legal_hold.is_(False),
            ).limit(500).with_for_update(skip_locked=True)
        ).all()
        for report in reports:
            attachments = db.scalars(select(ObjectAttachment).where(ObjectAttachment.report_id == report.id)).all()
            if any(attachment.object_id for attachment in attachments):
                raise RuntimeError("A report attachment cannot also belong to an infrastructure object")
            db.add(RetentionDeletion(
                report_id=report.id,
                storage_keys=[attachment.storage_key for attachment in attachments],
                policy_reference=settings.retention_policy_reference,
            ))
            for attachment in attachments:
                db.delete(attachment)
            db.flush()
            db.delete(report)
            removed += 1
        db.commit()
    flush_retention_deletions()
    return removed


def ledger_directory() -> Path:
    directory = Path(os.environ.get("RETENTION_LEDGER_DIRECTORY", "var/retention-ledger"))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return directory


def flush_retention_deletions() -> int:
    """Archive committed tombstones durably before deleting blobs; every step is retryable."""
    completed = 0
    directory = ledger_directory()
    with SessionLocal() as db:
        rows = db.scalars(select(RetentionDeletion).where(
            (RetentionDeletion.ledger_exported_at.is_(None)) |
            (RetentionDeletion.blobs_deleted_at.is_(None))
        ).limit(500)).all()
        for row in rows:
            event = {
                "id": row.id, "report_id": row.report_id, "storage_keys": row.storage_keys,
                "policy_reference": row.policy_reference, "deleted_at": row.deleted_at.isoformat(),
            }
            path = directory / f"{row.id}.json"
            if path.exists():
                if json.loads(path.read_text()) != event:
                    raise RuntimeError("Retention journal does not match the committed deletion")
            else:
                with tempfile.NamedTemporaryFile(mode="w", dir=directory, prefix=".pending-", delete=False) as output:
                    json.dump(event, output, sort_keys=True)
                    output.flush()
                    os.fsync(output.fileno())
                    pending = Path(output.name)
                pending.replace(path)
                directory_descriptor = os.open(directory, os.O_RDONLY)
                try:
                    os.fsync(directory_descriptor)
                finally:
                    os.close(directory_descriptor)
            row.ledger_exported_at = datetime.now(timezone.utc)
            db.commit()
            for key in row.storage_keys:
                delete_private(key)
            row.blobs_deleted_at = datetime.now(timezone.utc)
            db.commit()
            completed += 1
    return completed


def replay_retention_deletions() -> int:
    """Run with the latest separately preserved journal after restore, before reopening intake."""
    replayed = 0
    for path in sorted(ledger_directory().glob("*.json")):
        event = json.loads(path.read_text())
        UUID(event["id"])
        if event["report_id"] is not None:
            UUID(event["report_id"])
        keys = event["storage_keys"]
        if not isinstance(keys, list) or any(
            not isinstance(key, str) or key.startswith("/") or ".." in Path(key).parts for key in keys
        ):
            raise RuntimeError("Invalid retention journal keys")
        with SessionLocal() as db:
            row = db.get(RetentionDeletion, event["id"])
            if row is None:
                row = RetentionDeletion(
                    id=event["id"], report_id=event["report_id"], storage_keys=keys,
                    policy_reference=event["policy_reference"],
                    deleted_at=datetime.fromisoformat(event["deleted_at"]),
                )
                db.add(row)
            elif row.report_id != event["report_id"] or row.storage_keys != keys:
                raise RuntimeError("Restored deletion ledger mismatch")
            report = db.get(CitizenReport, row.report_id) if row.report_id else None
            if report:
                for attachment in db.scalars(select(ObjectAttachment).where(
                    ObjectAttachment.report_id == report.id
                )):
                    if attachment.object_id:
                        raise RuntimeError("Invalid shared attachment prevents retention replay")
                    db.delete(attachment)
                db.flush()
                db.delete(report)
            # Re-delete files even when an older snapshot restored a completed tombstone.
            row.blobs_deleted_at = None
            db.commit()
        replayed += 1
    flush_retention_deletions()
    return replayed


def scan_pending_attachments() -> int:
    if not settings.clamav_host:
        raise RuntimeError("ClamAV must be configured before quarantine can be released")
    with SessionLocal() as db:
        ids = db.scalars(select(ObjectAttachment.id).where(
            ObjectAttachment.scan_status == "quarantined",
            ObjectAttachment.deleted_at.is_(None),
        ).limit(100)).all()
    return sum(scan_attachment(attachment_id) == "clean" for attachment_id in ids)


def expire_auth_challenges() -> int:
    """OTP challenge data has no purpose after its configured authentication expiry."""
    with SessionLocal() as db:
        result = db.execute(delete(OTPChallenge).where(OTPChallenge.expires_at <= datetime.now(timezone.utc)))
        db.commit()
        return result.rowcount


def main() -> None:
    parser = argparse.ArgumentParser(description="FVV GIS background jobs")
    parser.add_argument("--retention", action="store_true", help="Apply the configured report retention policy")
    parser.add_argument("--scan-pending", action="store_true", help="Retry persisted quarantined attachments")
    parser.add_argument("--replay-deletions", action="store_true", help="Reapply the latest retention journal after restore")
    parser.add_argument("--flush-deletions", action="store_true", help="Retry committed retention blob deletions")
    parser.add_argument("--cleanup-auth", action="store_true", help="Delete authentication challenges past their expiry")
    args = parser.parse_args()
    if args.cleanup_auth:
        print(f"Expired authentication challenges removed: {expire_auth_challenges()}")
        return
    if args.replay_deletions:
        print(f"Deletion events replayed: {replay_retention_deletions()}")
        return
    if args.flush_deletions:
        print(f"Deletion events completed: {flush_retention_deletions()}")
        return
    if args.retention:
        print(f"Expired reports removed: {expire_closed_reports()}")
        return
    if args.scan_pending:
        print(f"Clean attachments: {scan_pending_attachments()}")
        return
    connection = Redis.from_url(settings.redis_url)
    Worker([Queue(connection=connection)], connection=connection).work(with_scheduler=True)


if __name__ == "__main__":
    main()
