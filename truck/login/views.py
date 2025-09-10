from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.contrib.auth.models import User
from django.db import IntegrityError
import logging

logger = logging.getLogger(__name__)

@csrf_protect
@never_cache
def login(request):
    if request.user.is_authenticated:
        return redirect('dashboard')  # Redirecionar para dashboard após login
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        
        if not username or not password:
            messages.error(request, 'Por favor, preencha todos os campos.')
            return render(request, 'login/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if user.is_active:
                auth_login(request, user)
                logger.info(f'Usuário {username} fez login com sucesso')
                return redirect('dashboard')
            else:
                messages.error(request, 'Conta desativada.')
        else:
            logger.warning(f'Tentativa de login falhada para usuário: {username}')
            messages.error(request, 'Usuário ou senha incorretos.')
    
    return render(request, 'login/login.html')

@login_required
def dashboard(request):
    return render(request, 'login/dashboard.html')

def logout_view(request):
    logout(request)
    messages.success(request, 'Logout realizado com sucesso.')
    return redirect('login')

def create_default_user():
    """Cria usuário padrão se não existir"""
    try:
        if not User.objects.filter(username='admin').exists():
            User.objects.create_user(
                username='admin',
                email='admin@truckplan.com',
                password='TruckPlan2024!',
                is_staff=True,
                is_superuser=True
            )
            logger.info('Usuário padrão criado: admin / TruckPlan2024!')
    except IntegrityError:
        logger.warning('Usuário padrão já existe')