"""Bootstrap mínimo para a Vercel quando o Postgres ainda não está configurado."""

from __future__ import annotations

import logging
import os

from django.conf import settings
from django.core.management import call_command
from django.db import connection

logger = logging.getLogger(__name__)


def ensure_sqlite_schema() -> None:
    if not os.environ.get('VERCEL'):
        return
    if 'sqlite' not in settings.DATABASES['default']['ENGINE']:
        return

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_user'")
            has_users = cursor.fetchone() is not None
        if not has_users:
            call_command('migrate', interactive=False, run_syncdb=True, verbosity=0)
        call_command('create_default_user', verbosity=0)
    except Exception:
        logger.exception('Falha ao preparar o SQLite da Vercel')
