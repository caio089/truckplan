"""Webhooks públicos: WA-AKG e ingestão do bot Baileys."""

from __future__ import annotations

import hmac
import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from login.models import WhatsAppConnection, WhatsAppSettings
from login.services.waakg_client import verify_webhook_signature
from login.services.whatsapp_report_flow import _create_daily_report, _normalize_extracted, handle_incoming_event
from login.views import json_login_required

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def waakg_webhook(request):
    if request.method == "GET":
        return JsonResponse({
            "ok": True,
            "service": "truckplan-wa-akg",
            "hint": "Use POST com X-Webhook-Signature para eventos do WA-AKG.",
        })

    raw_body = request.body
    signature = request.headers.get("X-Webhook-Signature") or request.META.get("HTTP_X_WEBHOOK_SIGNATURE")
    if not verify_webhook_signature(raw_body, signature):
        return JsonResponse({"ok": False, "error": "assinatura inválida"}, status=401)

    try:
        payload = json.loads(raw_body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "JSON inválido"}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({"ok": False, "error": "payload inválido"}, status=400)

    try:
        handle_incoming_event(payload)
    except Exception:
        logger.exception("Erro ao processar webhook WA-AKG")
        return JsonResponse({"ok": False}, status=500)

    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def baileys_ingest(request):
    if request.method == "GET":
        return JsonResponse({"ok": True, "service": "truckplan-baileys"})

    expected = settings.TRUCKPLAN_BOT_SECRET or ""
    provided = request.headers.get("X-Truckplan-Bot-Secret") or ""
    try:
        authorized = bool(expected) and hmac.compare_digest(expected, provided)
    except Exception:
        authorized = False
    if not authorized:
        return JsonResponse({"ok": False, "error": "não autorizado"}, status=401)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "JSON inválido"}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({"ok": False, "error": "payload inválido"}, status=400)

    normalized, missing = _normalize_extracted(payload)
    if missing:
        return JsonResponse({"ok": False, "missing": missing}, status=400)

    try:
        report = _create_daily_report(normalized)
    except Exception:
        logger.exception("Falha ao gravar relatório do Baileys")
        return JsonResponse({"ok": False}, status=500)

    return JsonResponse({"ok": True, "id": report.id})


def _bot_authorized(request) -> bool:
    expected = settings.TRUCKPLAN_BOT_SECRET or ""
    provided = request.headers.get("X-Truckplan-Bot-Secret") or ""
    try:
        return bool(expected) and hmac.compare_digest(expected, provided)
    except Exception:
        return False


def _connection() -> WhatsAppConnection:
    try:
        row, _created = WhatsAppConnection.objects.get_or_create(pk=1)
        return row
    except OperationalError:
        from django.core.management import call_command
        call_command('migrate', interactive=False, run_syncdb=True, verbosity=0)
        row, _created = WhatsAppConnection.objects.get_or_create(pk=1)
        return row


def _app_settings() -> WhatsAppSettings:
    try:
        row, _created = WhatsAppSettings.objects.get_or_create(pk=1)
        return row
    except OperationalError:
        from django.core.management import call_command
        call_command('migrate', interactive=False, run_syncdb=True, verbosity=0)
        row, _created = WhatsAppSettings.objects.get_or_create(pk=1)
        return row


@json_login_required
@require_http_methods(["GET", "POST"])
def whatsapp_settings(request):
    cfg = _app_settings()
    conn = _connection()
    if request.method == "POST":
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"ok": False, "error": "JSON inválido"}, status=400)
        number = "".join(ch for ch in str(payload.get("authorized_number") or "") if ch.isdigit())
        groq_key = str(payload.get("groq_api_key") or "").strip()
        cfg.authorized_number = number
        if groq_key and not groq_key.startswith("••••"):
            cfg.groq_api_key = groq_key
        cfg.save()
    return JsonResponse(_settings_payload(cfg, conn))


def _settings_payload(cfg: WhatsAppSettings, conn: WhatsAppConnection) -> dict:
    key = cfg.groq_api_key or settings.GROQ_API_KEY
    masked = ""
    if key:
        masked = f"••••{key[-4:]}"
    return {
        "ok": True,
        "authorized_number": cfg.authorized_number,
        "groq_api_key_masked": masked,
        "groq_configured": bool(key),
        "status": conn.status,
        "qr": conn.qr_text,
        "connected_jid": conn.connected_jid,
        "updated_at": conn.updated_at.isoformat() if conn.updated_at else None,
        "bot_running": conn.status in {"qr", "connected"} and bool(conn.updated_at),
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def baileys_session(request):
    if not _bot_authorized(request):
        return JsonResponse({"ok": False, "error": "não autorizado"}, status=401)

    cfg = _app_settings()
    if request.method == "GET":
        key = cfg.groq_api_key or settings.GROQ_API_KEY
        return JsonResponse({
            "ok": True,
            "groq_api_key": key,
            "authorized_number": cfg.authorized_number,
        })

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "JSON inválido"}, status=400)

    conn = _connection()
    status = str(payload.get("status") or "disconnected")[:24]
    conn.status = status
    if status == "qr":
        conn.qr_text = str(payload.get("qr") or "")
        conn.connected_jid = ""
    elif status == "connected":
        conn.qr_text = ""
        conn.connected_jid = str(payload.get("jid") or "")
    else:
        conn.qr_text = ""
        conn.connected_jid = ""
    conn.save()
    return JsonResponse({"ok": True})