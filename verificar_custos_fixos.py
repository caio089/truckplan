#!/usr/bin/env python
import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'truck.settings')
django.setup()

from login.models import CustoFixoMensal
from datetime import date

print('=== VERIFICAÇÃO DE CUSTOS FIXOS ===')
print(f'Total de custos fixos: {CustoFixoMensal.objects.count()}')
print(f'Custos ativos: {CustoFixoMensal.objects.filter(status="ativo").count()}')

print('\n=== CUSTOS FIXOS DETALHADOS ===')
for custo in CustoFixoMensal.objects.all():
    print(f'ID: {custo.id}')
    print(f'  Descrição: {custo.descricao}')
    print(f'  Status: {custo.status}')
    print(f'  Data início: {custo.data_inicio}')
    print(f'  Data fim: {custo.data_fim}')
    print(f'  Valor mensal: {custo.valor_mensal}')
    print(f'  Tipo: {custo.tipo_custo}')
    print('---')

print('\n=== VERIFICAÇÃO DE DATAS ===')
hoje = date.today()
print(f'Data atual: {hoje}')

custos_ativos = CustoFixoMensal.objects.filter(status='ativo')
print(f'Custos com status ativo: {custos_ativos.count()}')

for custo in custos_ativos:
    print(f'  {custo.descricao}:')
    print(f'    Data início: {custo.data_inicio} (<= hoje: {custo.data_inicio <= hoje})')
    if custo.data_fim:
        print(f'    Data fim: {custo.data_fim} (>= hoje: {custo.data_fim >= hoje})')
    else:
        print(f'    Data fim: None (sem data fim)')
    
    # Verificar se está ativo no período
    ativo_periodo = custo.data_inicio <= hoje and (custo.data_fim is None or custo.data_fim >= hoje)
    print(f'    Ativo no período: {ativo_periodo}')
    print('---')
