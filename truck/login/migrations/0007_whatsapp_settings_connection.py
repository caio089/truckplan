from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("login", "0006_whatsapp_pending_and_processed"),
    ]

    operations = [
        migrations.CreateModel(
            name="WhatsAppSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("groq_api_key", models.CharField(blank=True, max_length=200)),
                ("authorized_number", models.CharField(blank=True, max_length=32)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuração WhatsApp",
                "verbose_name_plural": "Configurações WhatsApp",
            },
        ),
        migrations.CreateModel(
            name="WhatsAppConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(default="disconnected", max_length=24)),
                ("qr_text", models.TextField(blank=True)),
                ("connected_jid", models.CharField(blank=True, max_length=80)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Conexão WhatsApp",
                "verbose_name_plural": "Conexões WhatsApp",
            },
        ),
    ]
