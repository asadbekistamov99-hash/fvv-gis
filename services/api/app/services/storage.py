"""Private storage and a fail-closed ClamAV scan. No user-controlled storage paths."""
from __future__ import annotations

import socket
import struct
from pathlib import Path

import boto3
from fastapi import HTTPException

from app.core.config import settings

ALLOWED_MIME = {"image/jpeg", "image/png", "application/pdf"}


def inspect_content(content: bytes, claimed_type: str | None) -> str:
    if not content or len(content) > settings.upload_max_bytes:
        raise HTTPException(413, "Fayl hajmi ruxsat etilgan chegaradan tashqarida")
    detected = ("image/jpeg" if content.startswith(b"\xff\xd8\xff") else
                "image/png" if content.startswith(b"\x89PNG\r\n\x1a\n") else
                "application/pdf" if content.startswith(b"%PDF-") else None)
    if detected is None or (claimed_type and claimed_type not in {detected, "application/octet-stream"}):
        raise HTTPException(422, "Faqat haqiqiy JPEG, PNG yoki PDF fayllar qabul qilinadi")
    return detected


def s3_client():
    return boto3.client("s3", endpoint_url=settings.s3_endpoint_url,
                        aws_access_key_id=settings.s3_access_key,
                        aws_secret_access_key=settings.s3_secret_key)


def save_private(key: str, content: bytes, mime: str) -> None:
    if settings.storage_backend == "s3":
        s3_client().put_object(Bucket=settings.s3_bucket, Key=key, Body=content, ContentType=mime)
    else:
        target = settings.upload_directory / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        target.chmod(0o600)


def read_private(key: str) -> bytes:
    if settings.storage_backend == "s3":
        return s3_client().get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read(settings.upload_max_bytes + 1)
    path = settings.upload_directory / key
    try:
        path.resolve().relative_to(settings.upload_directory.resolve())
    except ValueError as exc:
        raise HTTPException(404, "Fayl topilmadi") from exc
    if not path.is_file():
        raise HTTPException(404, "Fayl topilmadi")
    return path.read_bytes()


def delete_private(key: str) -> None:
    if settings.storage_backend == "s3":
        s3_client().delete_object(Bucket=settings.s3_bucket, Key=key)
    else:
        path = settings.upload_directory / key
        try:
            path.resolve().relative_to(settings.upload_directory.resolve())
        except ValueError:
            return
        path.unlink(missing_ok=True)


def scan_bytes(content: bytes) -> str:
    if not settings.clamav_host:
        return "quarantined"
    with socket.create_connection((settings.clamav_host, settings.clamav_port), timeout=30) as connection:
        connection.sendall(b"zINSTREAM\x00")
        for start in range(0, len(content), 65536):
            chunk = content[start:start + 65536]
            connection.sendall(struct.pack("!I", len(chunk)) + chunk)
        connection.sendall(struct.pack("!I", 0))
        result = connection.recv(4096).decode("utf-8", errors="replace")
    if "FOUND" in result:
        return "rejected"
    if "OK" in result:
        return "clean"
    return "quarantined"


def scan_attachment(attachment_id: str) -> str:
    from app.db.session import SessionLocal
    from app.models import ObjectAttachment
    with SessionLocal() as db:
        row = db.get(ObjectAttachment, attachment_id)
        if row is None:
            return "missing"
        row.scan_status = scan_bytes(read_private(row.storage_key))
        db.commit()
        return row.scan_status


def queue_scan(attachment_id: str) -> None:
    from redis import Redis
    from rq import Queue
    try:
        Queue("default", connection=Redis.from_url(settings.redis_url, socket_connect_timeout=2)).enqueue(
            "app.services.storage.scan_attachment", attachment_id, job_timeout=120
        )
    except Exception:
        # The persisted quarantine status is durable; the maintenance worker retries pending files.
        return
