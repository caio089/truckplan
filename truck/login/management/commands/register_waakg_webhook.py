from django.core.management.base import BaseCommand, CommandError

from login.services.waakg_client import register_incoming_webhook


class Command(BaseCommand):
    help = "Registra o webhook message.received no WA-AKG apontando para o TruckPlan."

    def add_arguments(self, parser):
        parser.add_argument(
            "--url",
            default="https://truckplan.vercel.app/login/webhooks/wa-akg/",
            help="URL pública do webhook no TruckPlan",
        )

    def handle(self, *args, **options):
        try:
            result = register_incoming_webhook(options["url"])
        except Exception as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f"Webhook registrado: {result}"))
