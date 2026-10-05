from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("login", "0005_alter_custofixomensal_tipo_custo_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="WhatsAppProcessedMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message_id", models.CharField(max_length=120, unique=True)),
                ("phone_number", models.CharField(max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Mensagem WhatsApp processada",
                "verbose_name_plural": "Mensagens WhatsApp processadas",
            },
        ),
        migrations.CreateModel(
            name="WhatsAppPendingReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone_number", models.CharField(max_length=32, unique=True)),
                ("source_message_id", models.CharField(max_length=120)),
                ("payload", models.JSONField()),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Relatório WhatsApp pendente",
                "verbose_name_plural": "Relatórios WhatsApp pendentes",
            },
        ),
    ]