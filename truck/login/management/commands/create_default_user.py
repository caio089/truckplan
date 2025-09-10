from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import IntegrityError
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Cria usuário padrão para o sistema TruckPlan'

    def handle(self, *args, **options):
        try:
            if not User.objects.filter(username='admin').exists():
                user = User.objects.create_user(
                    username='admin',
                    email='admin@truckplan.com',
                    password='TruckPlan2024!',
                    is_staff=True,
                    is_superuser=True,
                    first_name='Administrador',
                    last_name='TruckPlan'
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Usuário padrão criado com sucesso!\n'
                        f'Usuário: admin\n'
                        f'Senha: TruckPlan2024!'
                    )
                )
                logger.info('Usuário padrão criado: admin')
            else:
                self.stdout.write(
                    self.style.WARNING('Usuário padrão já existe!')
                )
        except IntegrityError as e:
            self.stdout.write(
                self.style.ERROR(f'Erro ao criar usuário: {e}')
            )
            logger.error(f'Erro ao criar usuário padrão: {e}')
