"""Fluxo: mensagem WhatsApp -> Grok -> rascunho -> DailyReport."""

from __future__ import annotations

import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction

from login.models import DailyReport, WhatsAppPendingReport, WhatsAppProcessedMessage
from login.services.grok_extractor import extract_report_from_text
from login.services.waakg_client import send_text_message

logger = logging.getLogger(__name__)

HELP_TEXT = (
    "Mande o frete em texto livre, por exemplo:\n"
    "Hoje saí de Teresina pra Fortaleza, 2 diárias, 180 L de diesel por R$ 1080, "
    "frete R$ 4500, motorista João, caminhão Scania.\n\n"
    "Eu monto o relatório e peço confirmação. Responda *1* ou *confirmar* para gravar, "
    "*2* ou *cancelar* para descartar."
)

CONFIRM_COMMANDS = {"1", "sim", "confirmar", "confirma", "ok"}
CANCEL_COMMANDS = {"2", "nao", "não", "cancelar", "cancela"}
HELP_COMMANDS = {"menu", "ajuda", "help", "frete", "oi", "ola", "olá"}


def digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def extract_phone_and_jid(data: dict) -> tuple[str, str]:
    jid = data.get("from") or data.get("sender") or (data.get("key") or {}).get("remoteJid") or ""
    jid = str(jid)
    phone = digits_only(jid.split("@")[0])
    return phone, jid


def is_authorized(phone: str) -> bool:
    allowed = [digits_only(item) for item in settings.WHATSAPP_AUTHORIZED_NUMBERS]
    allowed = [item for item in allowed if item]
    if not allowed:
        return False
    return phone in allowed or any(phone.endswith(item) or item.endswith(phone) for item in allowed)


def claim_message(message_id: str, phone: str) -> bool:
    if not message_id:
        return False
    try:
        WhatsAppProcessedMessage.objects.create(message_id=message_id, phone_number=phone)
        return True
    except IntegrityError:
        return False


def handle_incoming_event(payload: dict) -> None:
    if payload.get("event") != "message.received":
        return

    data = payload.get("data") or {}
    if data.get("fromMe") or (data.get("key") or {}).get("fromMe"):
        return
    if data.get("isGroup") or data.get("chatType") == "GROUP":
        return

    phone, jid = extract_phone_and_jid(data)
    if not phone or not is_authorized(phone):
        return

    text = (data.get("content") or data.get("caption") or "").strip()
    if not text:
        return

    message_id = str((data.get("key") or {}).get("id") or "")
    if not claim_message(message_id, phone):
        return

    session_id = str(payload.get("sessionId") or settings.WA_AKG_SESSION_ID or "")
    try:
        reply = process_text(phone, text, message_id)
        send_text_message(jid, reply, session_id=session_id)
    except Exception:
        logger.exception("Falha no fluxo WhatsApp")
        send_text_message(
            jid,
            "Não consegui processar agora. Tente de novo em instantes.",
            session_id=session_id,
        )


def process_text(phone: str, text: str, message_id: str) -> str:
    command = _normalize(text)

    if command in HELP_COMMANDS:
        return HELP_TEXT

    pending = WhatsAppPendingReport.objects.filter(phone_number=phone).first()

    if command in CANCEL_COMMANDS:
        if pending:
            pending.delete()
        return "Rascunho cancelado. Mande outro frete quando quiser."

    if command in CONFIRM_COMMANDS:
        if not pending:
            return "Não há relatório pendente. Envie os dados da viagem primeiro."
        report = _create_daily_report(pending.payload)
        pending.delete()
        return (
            f"Relatório #{report.id} gravado.\n"
            f"{report.data_viagem} | {report.partida} → {report.chegada}\n"
            f"Diárias: {report.diarias} | Diesel: {report.litros_gasolina} L / R$ {report.gasto_gasolina}\n"
            f"Frete: R$ {report.receita_frete} | {report.motorista} / {report.caminhao}"
        )

    extracted = extract_report_from_text(text, date.today().isoformat())
    normalized, missing = _normalize_extracted(extracted)
    if missing:
        lista = ", ".join(missing)
        return f"Faltou: {lista}.\nMande de novo com esses dados."

    WhatsAppPendingReport.objects.update_or_create(
        phone_number=phone,
        defaults={"source_message_id": message_id, "payload": normalized},
    )
    return (
        "Conferi assim:\n"
        f"Data: {normalized['data_viagem']}\n"
        f"Rota: {normalized['partida']} → {normalized['chegada']}\n"
        f"Diárias: {normalized['diarias']}\n"
        f"Diesel: {normalized['litros_gasolina']} L / R$ {normalized['gasto_gasolina']}\n"
        f"Frete: R$ {normalized['receita_frete']}\n"
        f"Motorista: {normalized['motorista']}\n"
        f"Caminhão: {normalized['caminhao']}\n\n"
        "Responda *1* para gravar no dashboard ou *2* para cancelar."
    )


def _normalize(value: str) -> str:
    return value.strip().lower().normalize("NFD").encode("ascii", "ignore").decode("ascii")


def _to_decimal(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    text = str(value).strip().replace("R$", "").replace(" ", "")
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        number = Decimal(text)
    except InvalidOperation:
        raise ValueError(f"Número inválido: {value}")
    if number < 0:
        raise ValueError("Número negativo")
    return number


def _normalize_extracted(raw: dict) -> tuple[dict, list[str]]:
    missing = [str(item) for item in (raw.get("missing") or []) if item]
    data_viagem = str(raw.get("data_viagem") or date.today().isoformat())
    partida = str(raw.get("partida") or "").strip()
    chegada = str(raw.get("chegada") or "").strip()
    motorista = str(raw.get("motorista") or settings.WHATSAPP_DEFAULT_MOTORISTA).strip()
    caminhao = str(raw.get("caminhao") or settings.WHATSAPP_DEFAULT_CAMINHAO).strip()

    try:
        diarias = int(_to_decimal(raw.get("diarias")))
        litros = _to_decimal(raw.get("litros_gasolina"))
        gasto = _to_decimal(raw.get("gasto_gasolina"))
        receita = _to_decimal(raw.get("receita_frete"))
        extra = _to_decimal(raw.get("custo_adicional"))
    except ValueError as exc:
        return {}, [str(exc)]

    required = {
        "partida": partida,
        "chegada": chegada,
        "motorista": motorista,
        "caminhao": caminhao,
    }
    for key, value in required.items():
        if not value and key not in missing:
            missing.append(key)

    payload = {
        "data_viagem": data_viagem,
        "partida": partida,
        "chegada": chegada,
        "diarias": diarias,
        "litros_gasolina": str(litros),
        "gasto_gasolina": str(gasto),
        "receita_frete": str(receita),
        "custo_adicional": str(extra),
        "motorista": motorista,
        "caminhao": caminhao,
    }
    return payload, missing


def _create_daily_report(payload: dict) -> DailyReport:
    with transaction.atomic():
        report = DailyReport.objects.create(
            data_viagem=payload["data_viagem"],
            partida=payload["partida"],
            chegada=payload["chegada"],
            diarias=int(payload["diarias"]),
            litros_gasolina=Decimal(str(payload["litros_gasolina"])),
            gasto_gasolina=Decimal(str(payload["gasto_gasolina"])),
            receita_frete=Decimal(str(payload["receita_frete"])),
            motorista=payload["motorista"],
            caminhao=payload["caminhao"],
        )
    return report