"""Bootstrap mínimo para a Vercel quando o Postgres ainda não está configurado."""

from __future__ import annotations

import logging
import os

from django.conf import settings
from django.core.management import call_command
from django.db import connection

logger = logging.getLogger(__name__)


def ensure_schema() -> None:
    if not os.environ.get('VERCEL'):
        return

    engine = settings.DATABASES['default']['ENGINE']
    try:
        missing = _whatsapp_tables_missing(engine)
        if missing:
            call_command('migrate', interactive=False, run_syncdb=True, verbosity=0)
        if 'sqlite' in engine:
            call_command('create_default_user', verbosity=0)
    except Exception:
        logger.exception('Falha ao preparar o banco na Vercel')


def _whatsapp_tables_missing(engine: str) -> bool:
    with connection.cursor() as cursor:
        if 'sqlite' in engine:
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='login_whatsappsettings'"
            )
            return cursor.fetchone() is None
        cursor.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'login_whatsappsettings'
            """
        )
        return cursor.fetchone() is None


def ensure_sqlite_schema() -> None:
    ensure_schema()
