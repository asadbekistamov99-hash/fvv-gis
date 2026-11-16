from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app import worker
from app.models import CitizenReport, ObjectAttachment, RetentionDeletion, User


@pytest.fixture
def retention_context(db, monkeypatch, tmp_path):
    @contextmanager
    def session():
        yield db

    monkeypatch.setattr(worker, "SessionLocal", session)
    monkeypatch.setenv("RETENTION_LEDGER_DIRECTORY", str(tmp_path / "ledger"))
    for key, value in {
        "retention_policy_approved": True, "retention_policy_reference": "approved-test-policy",
        "operator_name": "Test", "operator_contact": "operator@example.test", "responsible_team": "Test",
        "report_retention_days": 30, "audit_retention_days": 90, "backup_retention_days": 7,
    }.items():
        monkeypatch.setattr(worker.settings, key, value)
    user = User(phone="+998901001234", full_name="Synthetic test", role="citizen", is_synthetic=True)
    db.add(user)
    db.flush()
    report = CitizenReport(
        user_id=user.id, category="fault", description="Synthetic closed report", status="closed",
        closed_at=datetime.now(timezone.utc) - timedelta(days=31), is_synthetic=True,
    )
    db.add(report)
    db.flush()
    attachment = ObjectAttachment(
        report_id=report.id, uploaded_by=user.id, filename="test.jpg", content_type="image/jpeg",
        size_bytes=3, storage_key=f"test/{report.id}.jpg", sha256="0" * 64,
    )
    db.add(attachment)
    db.commit()
    return report, attachment, tmp_path


def test_retention_honors_legal_hold(db, monkeypatch, retention_context):
    report, _, path = retention_context
    report.legal_hold = True
    db.commit()
    monkeypatch.setattr(worker, "delete_private", lambda key: pytest.fail("Legal-hold file deletion"))
    assert worker.expire_closed_reports() == 0
    assert db.get(CitizenReport, report.id) is not None
    assert not list((path / "ledger").glob("*.json"))


def test_failed_db_commit_never_deletes_blob(db, monkeypatch, retention_context):
    removed = []
    monkeypatch.setattr(worker, "delete_private", removed.append)

    def fail():
        raise RuntimeError("Simulated database failure")

    monkeypatch.setattr(db, "commit", fail)
    with pytest.raises(RuntimeError, match="database failure"):
        worker.expire_closed_reports()
    assert removed == []
    db.rollback()


def test_blob_deletion_is_retryable_and_journal_replays_after_restore(db, monkeypatch, retention_context):
    report, attachment, path = retention_context
    report_id, user_id, key = report.id, report.user_id, attachment.storage_key

    def unavailable(key):
        raise OSError("Temporary object storage failure")

    monkeypatch.setattr(worker, "delete_private", unavailable)
    with pytest.raises(OSError):
        worker.expire_closed_reports()
    assert db.get(CitizenReport, report_id) is None
    ledger = db.scalar(select(RetentionDeletion).where(RetentionDeletion.report_id == report_id))
    assert ledger.blobs_deleted_at is None
    assert len(list((path / "ledger").glob("*.json"))) == 1
    removed = []
    monkeypatch.setattr(worker, "delete_private", removed.append)
    assert worker.flush_retention_deletions() == 1
    assert removed == [key]

    # Simulate restoring a pre-deletion database snapshot while retaining the latest journal.
    db.add(CitizenReport(
        id=report_id, user_id=user_id, category="fault", description="Restored private content",
        status="closed", closed_at=datetime.now(timezone.utc) - timedelta(days=31), is_synthetic=True,
    ))
    db.commit()
    assert worker.replay_retention_deletions() == 1
    assert db.get(CitizenReport, report_id) is None
    assert removed == [key, key]
