"""Extrai campos de relatório: Grok quando houver token; senão, parser local."""

from __future__ import annotations

import json
import logging
import re
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você extrai dados de relatórios de viagem de caminhão em português.
Responda SOMENTE um JSON válido, sem markdown.
Campos:
- data_viagem: YYYY-MM-DD (use hoje se a pessoa não informar: {hoje})
- partida: cidade/local de origem
- chegada: cidade/local de destino
- diarias: inteiro >= 0
- litros_gasolina: número (óleo diesel)
- gasto_gasolina: número em reais
- receita_frete: número em reais (0 se não informado)
- motorista: nome
- caminhao: nome ou placa
- custo_adicional: número em reais (0 se não houver)
- missing: lista de campos obrigatórios que faltam

Obrigatórios: partida, chegada, diarias, litros_gasolina, gasto_gasolina, motorista, caminhao.
Se a mensagem não for um relatório, missing deve listar todos os obrigatórios e os demais campos vazios/zero.
Não invente valores numéricos que a pessoa não disse.
"""

FIELD_ALIASES = {
    "origem": "partida",
    "partida": "partida",
    "chegada": "chegada",
    "destino": "chegada",
    "diarias": "diarias",
    "quantidade de diarias": "diarias",
    "litros de oleo": "litros_gasolina",
    "litros oleo": "litros_gasolina",
    "litros de diesel": "litros_gasolina",
    "litros diesel": "litros_gasolina",
    "litros gasolina": "litros_gasolina",
    "valor do oleo": "gasto_gasolina",
    "valor de oleo": "gasto_gasolina",
    "valor do diesel": "gasto_gasolina",
    "valor diesel": "gasto_gasolina",
    "gasto gasolina": "gasto_gasolina",
    "frete": "receita_frete",
    "receita": "receita_frete",
    "receita do frete": "receita_frete",
    "motorista": "motorista",
    "caminhao": "caminhao",
    "placa": "caminhao",
    "custo adicional": "custo_adicional",
}

REQUIRED = [
    "partida",
    "chegada",
    "diarias",
    "litros_gasolina",
    "gasto_gasolina",
    "motorista",
    "caminhao",
]


def extract_report_from_text(message: str, today_iso: str) -> dict:
    if settings.XAI_API_KEY:
        try:
            return _extract_with_grok(message, today_iso)
        except Exception:
            logger.exception("Grok falhou; usando parser local")
    return _extract_locally(message, today_iso)


def _extract_with_grok(message: str, today_iso: str) -> dict:
    body = json.dumps(
        {
            "model": settings.XAI_MODEL,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT.format(hoje=today_iso)},
                {"role": "user", "content": message},
            ],
        }
    ).encode("utf-8")
    request = Request(
        "https://api.x.ai/v1/chat/completions",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.XAI_API_KEY}",
        },
    )
    with urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))
    content = payload["choices"][0]["message"]["content"]
    return _parse_json_object(content)


def _extract_locally(message: str, today_iso: str) -> dict:
    values = {"data_viagem": today_iso, "receita_frete": "0", "custo_adicional": "0"}
    for line in message.replace("\r", "").split("\n"):
        line = line.strip()
        if ":" not in line:
            continue
        label, raw_value = line.split(":", 1)
        field = FIELD_ALIASES.get(_normalize_label(label))
        if field:
            values[field] = raw_value.strip()

    missing = [field for field in REQUIRED if not str(values.get(field) or "").strip()]
    values["missing"] = missing
    return values


def _normalize_label(value: str) -> str:
    return (
        value.strip()
        .lower()
        .normalize("NFD")
        .encode("ascii", "ignore")
        .decode("ascii")
        .replace(":", "")
    )


def _parse_json_object(content: str) -> dict:
    text = (content or "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("Grok não retornou JSON")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("JSON inválido")
    return data
