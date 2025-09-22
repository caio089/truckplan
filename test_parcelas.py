#!/usr/bin/env python
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'truck.settings')
django.setup()

from login.models import CustosGerais, ParcelaCusto
from datetime import date, timedelta
from decimal import Decimal

# Buscar custos parcelados
custos_parcelados = CustosGerais.objects.filter(forma_pagamento='parcelado')
print(f"Custos parcelados encontrados: {custos_parcelados.count()}")

for custo in custos_parcelados:
    print(f"\nCusto: {custo.descricao} - R$ {custo.valor}")
    parcelas = custo.parcelas.all()
    print(f"Parcelas: {parcelas.count()}")
    
    for parcela in parcelas:
        print(f"  Parcela {parcela.numero_parcela}: R$ {parcela.valor_parcela} - {parcela.status_pagamento}")
        
        # Simular o que a view faz
        if custo.forma_pagamento == 'parcelado' and custo.parcelas.exists():
            print(f"    -> Seria exibido como: {custo.descricao} - Parcela {parcela.numero_parcela}")
            print(f"    -> Valor: R$ {parcela.valor_parcela}")
            print(f"    -> Parcela: {parcela.numero_parcela}/{custo.parcelas.count()}")
