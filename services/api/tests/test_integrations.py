"""Provider boundary checks use intercepted HTTP; no SMS or push is sent."""
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from app import integrations


@pytest.fixture
def live_sms(monkeypatch):
    for key, value in {
        "sms_provider": "eskiz", "eskiz_email": "operator@example.test",
        "eskiz_password": "provider-secret", "live_intake_enabled": True,
        "retention_policy_approved": True, "retention_policy_reference": "test-policy",
        "operator_name": "Test operator", "operator_contact": "operator@example.test",
        "responsible_team": "Test team", "report_retention_days": 10,
        "audit_retention_days": 20, "backup_retention_days": 5,
    }.items():
        monkeypatch.setattr(integrations.settings, key, value)
    monkeypatch.setattr(integrations, "_sms_token", None)


def test_sms_refreshes_expired_provider_token_without_exposing_secrets(monkeypatch, live_sms):
    requests = []

    def post(url, **kwargs):
        requests.append((url, kwargs))
        if url.endswith("auth/login"):
            return httpx.Response(200, json={"data": {"token": f"token-{len(requests)}"}}, request=httpx.Request("POST", url))
        return httpx.Response(401 if len(requests) == 2 else 200, json={}, request=httpx.Request("POST", url))

    monkeypatch.setattr(integrations.httpx, "post", post)
    integrations.send_otp_sms("+998901234567", "123456")
    assert len(requests) == 4
    assert requests[-1][1]["data"]["mobile_phone"] == "998901234567"
    assert set(requests[-1][1]["data"]) == {"mobile_phone", "message", "from"}


def test_provider_failure_returns_safe_error(monkeypatch, live_sms):
    def post(url, **kwargs):
        return httpx.Response(500, text="provider-secret +998901234567", request=httpx.Request("POST", url))

    monkeypatch.setattr(integrations.httpx, "post", post)
    with pytest.raises(HTTPException) as error:
        integrations.send_otp_sms("+998901234567", "123456")
    assert error.value.status_code == 503
    assert "provider-secret" not in error.value.detail
    assert "998901234567" not in error.value.detail


def test_live_sms_refuses_unapproved_retention_policy(monkeypatch):
    monkeypatch.setattr(integrations.settings, "retention_policy_approved", False)
    with pytest.raises(HTTPException) as error:
        integrations.send_otp_sms("+998901234567", "123456")
    assert error.value.status_code == 503


def test_restricted_push_contains_only_generic_text_and_opaque_notification_id(monkeypatch):
    captured = []
    original_client = httpx.Client

    def receive(request):
        import json
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={"name": "projects/test/messages/1"})

    monkeypatch.setattr(integrations, "_firebase_credentials", lambda: SimpleNamespace(
        valid=True, project_id="test-project", token="access-token",
    ))
    monkeypatch.setattr(integrations.httpx, "Client", lambda **kwargs: original_client(
        transport=httpx.MockTransport(receive), **kwargs,
    ))
    assert integrations.send_push_message("device-token", "opaque-id")
    message = captured[0]["message"]
    assert message["data"] == {"notification_id": "opaque-id"}
    assert message["notification"]["title"] == "Yangi bildirishnoma"
    assert "geometry" not in message and "target_id" not in message["data"]
