"""Cliente HTTP do gateway WA-AKG v1.6.1.

Auth: header X-API-Key
Envio: POST /api/messages/{sessionId}/{jid}/send
Webhook: POST no TruckPlan, header X-Webhook-Signature: sha256=<hmac>
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


def verify_webhook_signature(raw_body: bytes, header_value: str | None) -> bool:
    secret = (settings.WA_AKG_WEBHOOK_SECRET or "").encode("utf-8")
    if not secret or not header_value:
        return False

    provided = header_value.strip().replace("sha256=", "", 1)
    expected = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided, expected)


def send_text_message(jid: str, text: str, session_id: str | None = None) -> None:
    base = (settings.WA_AKG_BASE_URL or "").rstrip("/")
    session = session_id or settings.WA_AKG_SESSION_ID
    api_key = settings.WA_AKG_API_KEY
    if not base or not session or not api_key:
        logger.warning("WA-AKG sem URL, sessão ou API key; resposta não enviada")
        return

    encoded_jid = quote(jid, safe="@.")
    url = f"{base}/api/messages/{quote(session)}/{encoded_jid}/send"
    _post_json(url, {"message": {"text": text}})


def register_incoming_webhook(public_url: str) -> dict:
    """POST /api/webhooks/{sessionId} conforme a documentação."""
    base = (settings.WA_AKG_BASE_URL or "").rstrip("/")
    session = settings.WA_AKG_SESSION_ID
    api_key = settings.WA_AKG_API_KEY
    secret = settings.WA_AKG_WEBHOOK_SECRET
    if not all([base, session, api_key, secret, public_url]):
        raise RuntimeError("Configure WA_AKG_BASE_URL, WA_AKG_SESSION_ID, WA_AKG_API_KEY e WA_AKG_WEBHOOK_SECRET")

    url = f"{base}/api/webhooks/{quote(session)}"
    return _post_json(
        url,
        {
            "name": "TruckPlan relatórios",
            "url": public_url,
            "secret": secret,
            "events": ["message.received"],
        },
    )


def _post_json(url: str, body: dict) -> dict:
    payload = json.dumps(body).encode("utf-8")
    request = Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": settings.WA_AKG_API_KEY,
        },
    )
    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.error("WA-AKG HTTP %s: %s", exc.code, detail)
        raise
    except URLError:
        logger.exception("WA-AKG inacessível")
        raise
