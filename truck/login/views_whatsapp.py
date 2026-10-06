"""Webhooks públicos: WA-AKG e ingestão do bot Baileys."""

from __future__ import annotations

import hmac
import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from login.services.waakg_client import verify_webhook_signature
from login.services.whatsapp_report_flow import _create_daily_report, _normalize_extracted, handle_incoming_event

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