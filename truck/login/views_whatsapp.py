"""Webhook público chamado pelo WA-AKG."""

from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from login.services.waakg_client import verify_webhook_signature
from login.services.whatsapp_report_flow import handle_incoming_event

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