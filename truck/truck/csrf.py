from django.http import JsonResponse
from django.views.csrf import csrf_failure as django_csrf_failure


def csrf_failure(request, reason=''):
    wants_json = (
        'application/json' in (request.META.get('CONTENT_TYPE') or '')
        or 'application/json' in (request.META.get('HTTP_ACCEPT') or '')
        or request.headers.get('X-CSRFToken')
        or request.path.startswith('/login/buscar-')
        or request.path.startswith('/login/listar-relatorios')
    )
    if wants_json:
        return JsonResponse(
            {
                'success': False,
                'error': 'Sessão inválida. Recarregue a página e faça login novamente.',
            },
            status=403,
        )
    return django_csrf_failure(request, reason=reason)
