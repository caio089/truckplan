from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import IntegrityError
import logging
import os

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Cria usuário padrão para o sistema TruckPlan'

    def handle(self, *args, **options):
        try:
            default_password = os.environ.get('DEFAULT_ADMIN_PASSWORD', 'lucas10')

            if not User.objects.filter(username='admin').exists():
                user = User.objects.create_user(
                    username='admin',
                    email='admin@truckplan.com',
                    password=default_password,
                    is_staff=True,
                    is_superuser=True,
                    first_name='Administrador',
                    last_name='TruckPlan'
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Usuário padrão criado com sucesso!\n'
                        f'Usuário: admin\n'
                        f'Senha: {default_password}'
                    )
                )
                logger.info('Usuário padrão criado: admin')
            else:
                user = User.objects.get(username='admin')
                user.set_password(default_password)
                user.is_staff = True
                user.is_superuser = True
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Senha do usuário admin redefinida com sucesso!\n'
                        f'Usuário: admin\n'
                        f'Nova senha: {default_password}'
                    )
                )
        except IntegrityError as e:
            self.stdout.write(
                self.style.ERROR(f'Erro ao criar usuário: {e}')
            )
            logger.error(f'Erro ao criar usuário padrão: {e}')
